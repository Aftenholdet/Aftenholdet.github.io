import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import sharp from 'sharp';

export const PIPELINE_VERSION = 3;
const PPTX_BUILD_KEY_VERSION = 2;
const IMAGE_SEQUENCE_BUILD_KEY_VERSION = 1;
const PAGE_TYPES = new Set(['overview', 'materials', 'build', 'finished']);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'content', 'build-guides.config.json');
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: false,
  isArray: (name) => name === 'Relationship' || name === 'p:sldId',
});

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((error) => {
    console.error(`[ERROR] ${error.message}`);
    if (process.env.DEBUG_PIPELINE) console.error(error.stack);
    process.exitCode = 1;
  });
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const selectedProjects = options.projectId
    ? config.projects.filter((project) => project.id === options.projectId)
    : config.projects;

  if (!selectedProjects.length) {
    throw new Error(`Projektet "${options.projectId}" findes ikke i ${relative(configPath)}.`);
  }

  console.log(`[DRY RUN] Kontrollerer ${selectedProjects.length} projekt(er), før output må skrives.`);
  let expectedBuildSteps = 0;
  for (const project of selectedProjects) {
    const result = await processProject(project, config, { ...options, analyzeOnly: true });
    expectedBuildSteps += result.stepCount;
  }

  if (!options.projectId) {
    if (selectedProjects.length !== config.expectedBuildGuideProjects) {
      throw new Error(`Dry run fandt ${selectedProjects.length} projekter; forventede ${config.expectedBuildGuideProjects}.`);
    }
    if (expectedBuildSteps !== config.expectedBuildSteps) {
      throw new Error(`Dry run fandt ${expectedBuildSteps} byggetrin; forventede ${config.expectedBuildSteps}. Konvertering er stoppet.`);
    }
  }
  console.log(`[DRY RUN OK] ${selectedProjects.length} projekt(er), ${expectedBuildSteps} byggetrin.`);

  if (options.analyzeOnly) return;

  console.log('[CONVERT] Dry run er godkendt. Konvertering starter.');
  for (const project of selectedProjects) await processProject(project, config, options);
  await writeGeneratedContentIndex(config, { requireAll: !options.projectId });
}

async function processProject(project, config, options) {
  if (getSourceType(project) === 'image-sequence') {
    return processImageSequenceProject(project, config, options);
  }

  const started = performance.now();
  const sourcePath = path.resolve(root, project.source);
  const outputRoot = path.resolve(root, config.outputRoot);
  const outputPath = path.resolve(outputRoot, project.id);
  assertInsideRoot(sourcePath, root, 'kilde');
  assertInsideRoot(outputPath, outputRoot, 'output');

  try {
    await access(sourcePath);
  } catch {
    throw new Error(`[${project.id}] Manglende kilde: ${relative(sourcePath)}`);
  }

  const sourceStats = await stat(sourcePath);
  const sourceBuffer = await readFile(sourcePath);
  const sourceSha256 = sha256(sourceBuffer);
  const settings = { ...config.defaults, ...project.conversion };
  const buildKey = sha256(JSON.stringify({
    pipelineVersion: PPTX_BUILD_KEY_VERSION,
    sourceSha256,
    project,
    settings,
  }));

  console.log(`[SOURCE] ${project.name}`);
  console.log(`         ${relative(sourcePath)}`);
  console.log(`         ${(sourceStats.size / 1024 / 1024).toFixed(2)} MB, SHA-256 ${sourceSha256.slice(0, 12)}…`);

  const archive = unzipSync(new Uint8Array(sourceBuffer));
  const presentation = analyzePresentation(archive);
  validateProjectSelection(project, presentation);
  for (const slideNumber of project.includeSlides) {
    validateExtractableSlide(project, presentation.slides[slideNumber - 1]);
  }
  printAnalysis(project, presentation);

  if (options.analyzeOnly) {
    console.log(`[CHECK] ${project.includeSlides.length} byggetrin kan udtrækkes sikkert (${formatDuration(started)}).`);
    return { stepCount: project.includeSlides.length };
  }

  if (!options.force && await outputIsCurrent(outputPath, buildKey, project.includeSlides.length)) {
    const elapsed = formatDuration(started);
    console.log(`[SKIP] ${project.id}: output er up-to-date (${elapsed}).`);
    return;
  }

  const temporaryPath = path.join(outputRoot, `.${project.id}-${process.pid}.tmp`);
  const backupPath = path.join(outputRoot, `.${project.id}-${process.pid}.backup`);
  await mkdir(outputRoot, { recursive: true });
  await rm(temporaryPath, { recursive: true, force: true });
  await mkdir(temporaryPath, { recursive: true });

  const steps = [];
  try {
    for (const [index, slideNumber] of project.includeSlides.entries()) {
      const analysis = presentation.slides[slideNumber - 1];
      const sourceImage = validateExtractableSlide(project, analysis);
      const mediaPath = sourceImage.path;
      const media = archive[mediaPath];
      if (!media) throw new Error(`[${project.id}] Slide ${slideNumber}: mangler ${mediaPath} i PPTX-arkivet.`);

      const filename = `${String(index + 1).padStart(3, '0')}.webp`;
      const temporaryFile = path.join(temporaryPath, filename);
      await sharp(Buffer.from(media), { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({
          width: settings.maxWidth,
          height: settings.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: settings.quality,
          alphaQuality: settings.alphaQuality,
          effort: settings.effort,
          nearLossless: settings.nearLossless,
          smartSubsample: true,
        })
        .toFile(temporaryFile);

      const outputBuffer = await readFile(temporaryFile);
      const outputMetadata = await sharp(outputBuffer).metadata();
      const publicPath = path.posix.join(config.outputRoot, project.id, filename);
      steps.push({
        number: index + 1,
        sourceSlide: slideNumber,
        sourceStepLabel: analysis.imageTitles[0] || null,
        sourceMedia: mediaPath,
        sourceRepresentation: sourceImage.representation,
        path: publicPath,
        width: outputMetadata.width,
        height: outputMetadata.height,
        bytes: outputBuffer.byteLength,
        sha256: sha256(outputBuffer),
      });
      console.log(`[WRITE] ${filename} ← slide ${slideNumber} (${formatBytes(outputBuffer.byteLength)})`);
    }

    const totalBytes = steps.reduce((sum, step) => sum + step.bytes, 0);
    const manifest = {
      schemaVersion: 1,
      id: project.id,
      name: project.displayName,
      displayName: project.displayName,
      level: project.levelId,
      buildKey,
      generatedAt: new Date().toISOString(),
      source: {
        type: 'pptx',
        path: project.source,
        bytes: sourceStats.size,
        modifiedUtc: sourceStats.mtime.toISOString(),
        sha256: sourceSha256,
        slideCount: presentation.slides.length,
        fileName: project.sourceFileName,
        internalTitle: project.sourceInternalTitle,
      },
      conversion: {
        pipelineVersion: PIPELINE_VERSION,
        strategy: project.strategy,
        ...settings,
      },
      excludedSlides: project.excludedSlides,
      sequenceNotes: project.sequenceNotes,
      projectSpecificCodeSource: project.projectSpecificCodeSource || null,
      slideAnalysis: presentation.slides.map((slide) => ({
        slide: slide.number,
        included: project.includeSlides.includes(slide.number),
        classification: project.excludedSlides.find((entry) => entry.slide === slide.number)?.classification || 'build-step',
        text: slide.text,
        pictureCount: slide.pictureCount,
        backgroundImageCount: slide.backgroundImageCount,
        shapeCount: slide.shapeCount,
        graphicFrameCount: slide.graphicFrameCount,
        imageTitles: slide.imageTitles,
      })),
      buildSteps: steps.map((step) => step.path),
      steps,
      output: {
        imageCount: steps.length,
        totalBytes,
        sha256: sha256(steps.map((step) => step.sha256).join('\n')),
      },
    };

    await writeFile(path.join(temporaryPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await replaceDirectoryAtomically(temporaryPath, outputPath, backupPath);
    console.log(`[DONE] ${steps.length} billeder, ${formatBytes(totalBytes)}, ${formatDuration(started)}.`);
    console.log(`       ${relative(outputPath)}`);
    return { stepCount: steps.length };
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
}

async function processImageSequenceProject(project, config, options) {
  const started = performance.now();
  const sourcePath = path.resolve(root, project.source);
  const outputRoot = path.resolve(root, config.outputRoot);
  const outputPath = path.resolve(outputRoot, project.id);
  assertInsideRoot(sourcePath, root, 'kilde');
  assertInsideRoot(outputPath, outputRoot, 'output');

  const source = await analyzeImageSequence(sourcePath, project);
  validatePageSemantics(project, source.entries.length);
  const settings = { ...config.defaults, ...project.conversion };
  const buildKey = computeBuildKey({
    sourceType: 'image-sequence',
    sourceSha256: source.sha256,
    project,
    settings,
  });

  console.log(`[SOURCE] ${project.name}`);
  console.log(`         ${relative(sourcePath)}`);
  console.log(`         ${formatBytes(source.totalBytes)}, SHA-256 ${source.sha256.slice(0, 12)}…`);
  printImageSequenceAnalysis(project, source);

  if (options.analyzeOnly) {
    console.log(`[CHECK] ${source.entries.length} byggetrin kan udtrækkes sikkert (${formatDuration(started)}).`);
    return { stepCount: source.entries.length };
  }

  if (!options.force && await outputIsCurrent(outputPath, buildKey, source.entries.length)) {
    console.log(`[SKIP] ${project.id}: output er up-to-date (${formatDuration(started)}).`);
    return { stepCount: source.entries.length, status: 'skipped' };
  }

  const temporaryPath = path.join(outputRoot, `.${project.id}-${process.pid}.tmp`);
  const backupPath = path.join(outputRoot, `.${project.id}-${process.pid}.backup`);
  await mkdir(outputRoot, { recursive: true });
  await rm(temporaryPath, { recursive: true, force: true });
  await mkdir(temporaryPath, { recursive: true });

  const steps = [];
  try {
    for (const [index, entry] of source.entries.entries()) {
      const input = await readFile(entry.absolutePath);
      const filename = `${String(index + 1).padStart(3, '0')}.webp`;
      const temporaryFile = path.join(temporaryPath, filename);
      await sharp(input, { limitInputPixels: 80_000_000 })
        .rotate()
        .resize({
          width: settings.maxWidth,
          height: settings.maxHeight,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({
          quality: settings.quality,
          alphaQuality: settings.alphaQuality,
          effort: settings.effort,
          nearLossless: settings.nearLossless,
          smartSubsample: true,
        })
        .toFile(temporaryFile);

      const outputBuffer = await readFile(temporaryFile);
      const outputMetadata = await sharp(outputBuffer).metadata();
      const publicPath = path.posix.join(config.outputRoot, project.id, filename);
      const pageMetadata = resolvePageMetadata(project, index + 1, source.entries.length);
      steps.push({
        number: index + 1,
        ...pageMetadata,
        sourceType: 'image-sequence',
        sourceSequence: entry.sequence,
        sourceFile: entry.fileName,
        sourcePath: path.posix.join(project.source, entry.fileName),
        sourceSha256: entry.sha256,
        sourceRepresentation: 'image-sequence',
        path: publicPath,
        width: outputMetadata.width,
        height: outputMetadata.height,
        bytes: outputBuffer.byteLength,
        sha256: sha256(outputBuffer),
      });
      console.log(`[WRITE] ${filename} ← ${entry.fileName} (${formatBytes(outputBuffer.byteLength)})`);
    }

    const totalBytes = steps.reduce((sum, step) => sum + step.bytes, 0);
    const manifest = {
      schemaVersion: 2,
      id: project.id,
      name: project.displayName,
      displayName: project.displayName,
      level: project.levelId,
      buildKey,
      generatedAt: new Date().toISOString(),
      source: {
        type: 'image-sequence',
        path: project.source,
        bytes: source.totalBytes,
        modifiedUtc: source.modifiedUtc,
        sha256: source.sha256,
        imageCount: source.entries.length,
        ordering: project.ordering,
        sequencePattern: project.sequencePattern,
        sequenceStart: source.entries[0].sequence,
        sequenceEnd: source.entries.at(-1).sequence,
        files: source.entries.map((entry) => ({
          sequence: entry.sequence,
          fileName: entry.fileName,
          bytes: entry.bytes,
          width: entry.width,
          height: entry.height,
          sha256: entry.sha256,
        })),
      },
      buildSource: {
        type: 'image-sequence',
        path: project.source,
        ordering: project.ordering,
        note: project.buildSourceNote || null,
      },
      legacySource: project.legacySource || null,
      conversion: {
        pipelineVersion: PIPELINE_VERSION,
        sourceProcessorVersion: IMAGE_SEQUENCE_BUILD_KEY_VERSION,
        strategy: project.strategy,
        ...settings,
      },
      excludedSlides: [],
      sequenceNotes: project.sequenceNotes || [],
      pageSemantics: project.pageSemantics || null,
      projectSpecificCodeSource: project.projectSpecificCodeSource || null,
      slideAnalysis: null,
      buildSteps: steps.map((step) => step.path),
      steps,
      output: {
        imageCount: steps.length,
        totalBytes,
        sha256: sha256(steps.map((step) => step.sha256).join('\n')),
      },
    };

    await writeFile(path.join(temporaryPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await replaceDirectoryAtomically(temporaryPath, outputPath, backupPath);
    console.log(`[DONE] ${steps.length} billeder, ${formatBytes(totalBytes)}, ${formatDuration(started)}.`);
    console.log(`       ${relative(outputPath)}`);
    return { stepCount: steps.length, status: 'built' };
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
}

export async function analyzeImageSequence(sourcePath, project) {
  let directoryEntries;
  try {
    directoryEntries = await readdir(sourcePath, { withFileTypes: true });
  } catch (error) {
    throw new Error(`[${project.id}] Image-sequence-kilden kan ikke læses: ${error.message}`);
  }

  if (!directoryEntries.length) throw new Error(`[${project.id}] Image-sequence-kilden er tom.`);
  if (project.ordering !== 'numeric-filename') {
    throw new Error(`[${project.id}] Ukendt image-sequence-sortering: ${project.ordering || '(mangler)'}.`);
  }

  let sequencePattern;
  try {
    sequencePattern = new RegExp(project.sequencePattern, 'i');
  } catch {
    throw new Error(`[${project.id}] Ugyldigt sequencePattern.`);
  }

  const unknownEntries = [];
  const candidates = [];
  for (const directoryEntry of directoryEntries) {
    const match = directoryEntry.isFile() ? directoryEntry.name.match(sequencePattern) : null;
    const sequence = Number(match?.[1]);
    if (!match || !Number.isSafeInteger(sequence) || sequence < 1) {
      unknownEntries.push(directoryEntry.name);
      continue;
    }
    candidates.push({ fileName: directoryEntry.name, sequence });
  }
  if (unknownEntries.length) {
    throw new Error(`[${project.id}] Ukendte filer eller mapper i image-sequence: ${unknownEntries.join(', ')}.`);
  }

  const entries = [];
  for (const candidate of candidates) {
    const absolutePath = path.join(sourcePath, candidate.fileName);
    const [buffer, fileStats] = await Promise.all([readFile(absolutePath), stat(absolutePath)]);
    const metadata = await sharp(buffer, { limitInputPixels: 80_000_000 }).metadata();
    if (metadata.format !== 'png') {
      throw new Error(`[${project.id}] ${candidate.fileName} er ikke en gyldig PNG-fil.`);
    }
    if (project.expectedDimensions && (
      metadata.width !== project.expectedDimensions.width || metadata.height !== project.expectedDimensions.height
    )) {
      throw new Error(
        `[${project.id}] ${candidate.fileName} har ${metadata.width}x${metadata.height}; ` +
        `forventede ${project.expectedDimensions.width}x${project.expectedDimensions.height}.`,
      );
    }
    entries.push({
      ...candidate,
      absolutePath,
      bytes: fileStats.size,
      modifiedMs: fileStats.mtimeMs,
      width: metadata.width,
      height: metadata.height,
      sha256: sha256(buffer),
    });
  }

  entries.splice(0, entries.length, ...sortImageSequenceEntries(entries));
  const duplicateNumbers = entries
    .filter((entry, index) => index > 0 && entry.sequence === entries[index - 1].sequence)
    .map((entry) => entry.sequence);
  if (duplicateNumbers.length) {
    throw new Error(`[${project.id}] Dublerede sekvensnumre: ${[...new Set(duplicateNumbers)].join(', ')}.`);
  }

  const expectedStart = project.expectedSequenceStart ?? entries[0]?.sequence;
  const expectedEnd = project.expectedSequenceEnd ?? entries.at(-1)?.sequence;
  const actualNumbers = new Set(entries.map((entry) => entry.sequence));
  const missing = [];
  for (let sequence = expectedStart; sequence <= expectedEnd; sequence += 1) {
    if (!actualNumbers.has(sequence)) missing.push(sequence);
  }
  if (missing.length) throw new Error(`[${project.id}] Manglende sekvensnumre: ${missing.join(', ')}.`);
  if (entries.length !== project.expectedImageCount) {
    throw new Error(`[${project.id}] Fandt ${entries.length} billeder; forventede ${project.expectedImageCount}.`);
  }
  if (entries[0]?.sequence !== expectedStart || entries.at(-1)?.sequence !== expectedEnd) {
    throw new Error(`[${project.id}] Sekvensen matcher ikke forventet interval ${expectedStart}-${expectedEnd}.`);
  }

  if (project.rejectDuplicateContent) {
    const hashes = new Set();
    for (const entry of entries) {
      if (hashes.has(entry.sha256)) throw new Error(`[${project.id}] Dublerede billeder fundet ved ${entry.fileName}.`);
      hashes.add(entry.sha256);
    }
  }

  const sequenceHash = createHash('sha256');
  for (const entry of entries) {
    sequenceHash.update(`${entry.sequence}\0${entry.fileName}\0${entry.bytes}\0${entry.sha256}\n`);
  }
  return {
    entries,
    totalBytes: entries.reduce((sum, entry) => sum + entry.bytes, 0),
    modifiedUtc: new Date(Math.max(...entries.map((entry) => entry.modifiedMs))).toISOString(),
    sha256: sequenceHash.digest('hex'),
  };
}

export function sortImageSequenceEntries(entries) {
  return [...entries].sort(
    (left, right) => left.sequence - right.sequence || left.fileName.localeCompare(right.fileName, 'en'),
  );
}

export function computeBuildKey({ sourceType, sourceSha256, project, settings }) {
  const pipelineVersion = sourceType === 'pptx' ? PPTX_BUILD_KEY_VERSION : PIPELINE_VERSION;
  const input = { pipelineVersion, sourceSha256, project, settings };
  if (sourceType === 'image-sequence') input.sourceProcessorVersion = IMAGE_SEQUENCE_BUILD_KEY_VERSION;
  return sha256(JSON.stringify(input));
}

export function validatePageSemantics(project, pageCount) {
  if (!project.pageSemantics) return;
  if (!Array.isArray(project.pageSemantics) || project.pageSemantics.length === 0) {
    throw new Error(`[${project.id}] pageSemantics skal indeholde mindst ét interval.`);
  }

  const coveredPages = new Set();
  for (const range of project.pageSemantics) {
    if (!PAGE_TYPES.has(range.type)) {
      throw new Error(`[${project.id}] Ukendt sidetype: ${range.type || '(mangler)'}.`);
    }
    if (!Number.isInteger(range.pageStart) || !Number.isInteger(range.pageEnd) || range.pageStart < 1 || range.pageEnd < range.pageStart) {
      throw new Error(`[${project.id}] Ugyldigt sideinterval for ${range.type}.`);
    }
    for (let page = range.pageStart; page <= range.pageEnd; page += 1) {
      if (page > pageCount) throw new Error(`[${project.id}] Sideinterval går ud over de ${pageCount} sider.`);
      if (coveredPages.has(page)) throw new Error(`[${project.id}] Side ${page} har flere semantiske typer.`);
      coveredPages.add(page);
    }
  }
  if (coveredPages.size !== pageCount) {
    const missing = Array.from({ length: pageCount }, (_, index) => index + 1).filter((page) => !coveredPages.has(page));
    throw new Error(`[${project.id}] Sider uden semantisk type: ${missing.join(', ')}.`);
  }
}

export function resolvePageMetadata(project, pageNumber, pageCount) {
  const ranges = project.pageSemantics || [{ type: 'build', pageStart: 1, pageEnd: pageCount }];
  const range = ranges.find((entry) => pageNumber >= entry.pageStart && pageNumber <= entry.pageEnd);
  if (!range) throw new Error(`[${project.id}] Side ${pageNumber} mangler semantisk metadata.`);

  const sectionIndex = pageNumber - range.pageStart + 1;
  const sectionTotal = range.pageEnd - range.pageStart + 1;
  const buildRanges = ranges.filter((entry) => entry.type === 'build');
  const instructionTotal = buildRanges.reduce((sum, entry) => sum + entry.pageEnd - entry.pageStart + 1, 0);
  const precedingBuildPages = buildRanges
    .filter((entry) => entry.pageEnd < range.pageStart)
    .reduce((sum, entry) => sum + entry.pageEnd - entry.pageStart + 1, 0);
  const instructionNumber = range.type === 'build' ? precedingBuildPages + sectionIndex : null;
  const labels = {
    overview: 'Oversigt',
    materials: `Materialer · ${sectionIndex} af ${sectionTotal}`,
    build: `Trin ${instructionNumber} af ${instructionTotal}`,
    finished: 'Færdig',
  };

  return {
    pageType: range.type,
    pageLabel: labels[range.type],
    sectionIndex,
    sectionTotal,
    instructionNumber,
    instructionTotal: range.type === 'build' ? instructionTotal : null,
  };
}

function getSourceType(project) {
  const sourceType = project.sourceType || 'pptx';
  if (!['pptx', 'image-sequence'].includes(sourceType)) {
    throw new Error(`[${project.id}] Ukendt sourceType: ${sourceType}.`);
  }
  return sourceType;
}

function getExpectedStepCount(project) {
  return getSourceType(project) === 'image-sequence' ? project.expectedImageCount : project.includeSlides.length;
}

function printImageSequenceAnalysis(project, source) {
  console.log(
    `[ANALYZE] ${source.entries.length} PNG-filer, numerisk sekvens ` +
    `${source.entries[0].sequence}-${source.entries.at(-1).sequence}.`,
  );
  for (const note of project.sequenceNotes || []) console.log(`          note: ${note}`);
}

export function analyzePresentation(archive) {
  const presentationXml = parseXmlEntry(archive, 'ppt/presentation.xml');
  const relationshipsXml = parseXmlEntry(archive, 'ppt/_rels/presentation.xml.rels');
  const relationshipList = asArray(relationshipsXml.Relationships?.Relationship);
  const relationshipMap = new Map(relationshipList.map((relationship) => [
    relationship['@_Id'],
    relationship,
  ]));
  const slideIds = asArray(presentationXml['p:presentation']?.['p:sldIdLst']?.['p:sldId']);

  if (!slideIds.length) throw new Error('PPTX-filen indeholder ingen slides i presentation.xml.');

  const slides = slideIds.map((slideId, index) => {
    const relationshipId = slideId['@_r:id'];
    const relationship = relationshipMap.get(relationshipId);
    if (!relationship || !String(relationship['@_Type']).endsWith('/slide')) {
      throw new Error(`Slide ${index + 1}: relationen ${relationshipId} blev ikke fundet.`);
    }
    const slidePath = path.posix.normalize(path.posix.join('ppt', relationship['@_Target']));
    return analyzeSlide(archive, slidePath, index + 1);
  });

  return { slides };
}

export function analyzeSlide(archive, slidePath, number) {
  const slideXml = parseXmlEntry(archive, slidePath);
  const relsPath = path.posix.join(
    path.posix.dirname(slidePath),
    '_rels',
    `${path.posix.basename(slidePath)}.rels`,
  );
  const relsXml = parseXmlEntry(archive, relsPath);
  const relationships = asArray(relsXml.Relationships?.Relationship);
  const relationshipMap = new Map(relationships.map((relationship) => [relationship['@_Id'], relationship]));
  const collected = collectSlideContent(slideXml);
  const images = collected.imageReferences.map((reference) => {
    const relationship = relationshipMap.get(reference.relationshipId);
    if (!relationship || !String(relationship['@_Type']).endsWith('/image')) {
      throw new Error(`Slide ${number}: billedrelationen ${reference.relationshipId} blev ikke fundet.`);
    }
    if (relationship['@_TargetMode'] === 'External') {
      throw new Error(`Slide ${number}: billedrelationen ${reference.relationshipId} er ekstern.`);
    }
    const imagePath = path.posix.normalize(path.posix.join(path.posix.dirname(slidePath), relationship['@_Target']));
    if (!archive[imagePath]) throw new Error(`Slide ${number}: billedfilen ${imagePath} blev ikke fundet.`);
    return {
      relationshipId: reference.relationshipId,
      representation: reference.representation,
      path: imagePath,
      format: path.posix.extname(imagePath).slice(1).toLowerCase(),
    };
  });

  return {
    number,
    slidePath,
    text: collected.text.join(' ').replace(/\s+/g, ' ').trim(),
    imageTitles: collected.imageTitles,
    images,
    pictureCount: collected.pictureCount,
    backgroundImageCount: collected.backgroundImageCount,
    groupShapeCount: collected.groupShapeCount,
    shapeCount: collected.shapeCount,
    graphicFrameCount: collected.graphicFrameCount,
    connectorCount: collected.connectorCount,
    oleCount: collected.oleCount,
    controlCount: collected.controlCount,
  };
}

export function collectSlideContent(document) {
  const result = {
    text: [],
    imageTitles: [],
    imageReferences: [],
    pictureCount: 0,
    backgroundImageCount: 0,
    groupShapeCount: 0,
    shapeCount: 0,
    graphicFrameCount: 0,
    connectorCount: 0,
    oleCount: 0,
    controlCount: 0,
  };

  function visit(node, key = '', imageContext = 'other') {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, key, imageContext));
      return;
    }
    if (!node || typeof node !== 'object') {
      if (key === 'a:t' && node != null) result.text.push(String(node));
      return;
    }

    let childImageContext = imageContext;
    if (key === 'p:bg') {
      result.backgroundImageCount += 1;
      childImageContext = 'slide-background';
    }
    if (key === 'p:pic') {
      result.pictureCount += 1;
      childImageContext = 'picture';
    }
    if (key === 'p:grpSp') result.groupShapeCount += 1;
    if (key === 'p:sp') result.shapeCount += 1;
    if (key === 'p:graphicFrame') result.graphicFrameCount += 1;
    if (key === 'p:cxnSp') result.connectorCount += 1;
    if (key === 'p:oleObj') result.oleCount += 1;
    if (key === 'p:control') result.controlCount += 1;
    if (key === 'a:blip' && node['@_r:embed']) {
      result.imageReferences.push({
        relationshipId: node['@_r:embed'],
        representation: childImageContext,
      });
    }
    if (key === 'p:cNvPr' && node['@_title']) result.imageTitles.push(node['@_title']);

    for (const [childKey, child] of Object.entries(node)) visit(child, childKey, childImageContext);
  }

  visit(document);
  return result;
}

function parseXmlEntry(archive, entryPath) {
  const entry = archive[entryPath];
  if (!entry) throw new Error(`PPTX-arkivet mangler ${entryPath}.`);
  return parser.parse(strFromU8(entry));
}

function validateProjectSelection(project, presentation) {
  if (presentation.slides.length !== project.expectedSlideCount) {
    throw new Error(
      `[${project.id}] Forventede ${project.expectedSlideCount} slides, men kilden har ${presentation.slides.length}. ` +
      'Gennemgå klassifikationen før konvertering.',
    );
  }

  const allSelected = [...project.includeSlides, ...project.excludedSlides.map((entry) => entry.slide)];
  const unique = new Set(allSelected);
  if (unique.size !== allSelected.length) throw new Error(`[${project.id}] En slide er både inkluderet/ekskluderet eller nævnt flere gange.`);
  const expected = presentation.slides.map((slide) => slide.number);
  if (unique.size !== expected.length || expected.some((number) => !unique.has(number))) {
    throw new Error(`[${project.id}] Alle slides skal klassificeres eksplicit som inkluderet eller ekskluderet.`);
  }

  if (!project.includeSlides.every((number, index, list) => index === 0 || number > list[index - 1])) {
    throw new Error(`[${project.id}] includeSlides skal stå i stigende præsentationsrækkefølge.`);
  }

  const backgroundSlides = project.backgroundImageSlides || [];
  if (new Set(backgroundSlides).size !== backgroundSlides.length) {
    throw new Error(`[${project.id}] backgroundImageSlides indeholder dubletter.`);
  }
  if (backgroundSlides.some((slide) => !project.includeSlides.includes(slide))) {
    throw new Error(`[${project.id}] Alle backgroundImageSlides skal være inkluderede byggetrin.`);
  }
}

export function validateExtractableSlide(project, slide) {
  const issues = [];
  if (project.strategy !== 'extract-single-slide-image') issues.push(`ukendt strategi ${project.strategy}`);
  const pictureImages = slide.images.filter((image) => image.representation === 'picture');
  const backgroundImages = slide.images.filter((image) => image.representation === 'slide-background');
  const otherImages = slide.images.filter((image) => image.representation === 'other');
  const backgroundDeclared = (project.backgroundImageSlides || []).includes(slide.number);
  let sourceImage = null;

  if (backgroundDeclared) {
    if (slide.backgroundImageCount !== 1 || backgroundImages.length !== 1) {
      issues.push(`${backgroundImages.length} background-relationer/${slide.backgroundImageCount} baggrundsobjekter`);
    } else {
      sourceImage = backgroundImages[0];
    }
    if (slide.pictureCount || pictureImages.length || otherImages.length || slide.images.length !== 1) {
      issues.push('slide-background har ekstra billeder');
    }
  } else {
    if (backgroundImages.length || slide.backgroundImageCount) issues.push('ikke-deklareret slide-background');
    if (slide.pictureCount !== 1 || pictureImages.length !== 1 || otherImages.length || slide.images.length !== 1) {
      issues.push(`${slide.images.length} billedrelationer/${slide.pictureCount} billedobjekter`);
    } else {
      sourceImage = pictureImages[0];
    }
  }

  if (sourceImage && !isRasterFormat(sourceImage.format)) issues.push(`ikke-raster format ${sourceImage.format || '(ukendt)'}`);
  if (slide.text) issues.push(`tekstlaget "${slide.text.slice(0, 80)}"`);
  if (slide.shapeCount) issues.push(`${slide.shapeCount} tekst-/formobjekter`);
  if (slide.groupShapeCount) issues.push(`${slide.groupShapeCount} grupperede formobjekter`);
  if (slide.graphicFrameCount) issues.push(`${slide.graphicFrameCount} diagram-/tabelobjekter`);
  if (slide.connectorCount) issues.push(`${slide.connectorCount} forbindelseslinjer`);
  if (slide.oleCount) issues.push(`${slide.oleCount} OLE-objekter`);
  if (slide.controlCount) issues.push(`${slide.controlCount} kontrolobjekter`);
  if (issues.length) {
    throw new Error(
      `[${project.id}] Slide ${slide.number} kan ikke udtrækkes sikkert som ét billede: ${issues.join(', ')}. ` +
      'Brug en fuld PPTX-renderer eller gennemgå slidevalget.',
    );
  }
  return sourceImage;
}

function isRasterFormat(format) {
  return ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'tif', 'tiff'].includes(format);
}

function printAnalysis(project, presentation) {
  console.log(`[ANALYZE] ${presentation.slides.length} slides er klassificeret eksplicit.`);
  for (const excluded of project.excludedSlides) {
    const slide = presentation.slides[excluded.slide - 1];
    const detail = slide.text ? `tekst: "${slide.text}"` : `${slide.pictureCount} billede(r), ingen tekst`;
    console.log(`          slide ${excluded.slide}: ${excluded.classification} — ${excluded.reason} (${detail})`);
  }
  console.log(`          inkluderet: slide ${project.includeSlides[0]}-${project.includeSlides.at(-1)} (${project.includeSlides.length} webtrin)`);
  for (const note of project.sequenceNotes || []) console.log(`          note: ${note}`);
}

export async function outputIsCurrent(outputPath, buildKey, expectedCount, assetRoot = root) {
  try {
    const manifest = JSON.parse(await readFile(path.join(outputPath, 'manifest.json'), 'utf8'));
    if (manifest.buildKey !== buildKey || manifest.steps?.length !== expectedCount) return false;
    for (const step of manifest.steps) {
      const fileStats = await stat(path.join(assetRoot, step.path));
      if (!fileStats.isFile() || fileStats.size !== step.bytes) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function writeGeneratedContentIndex(config, options = {}) {
  const guides = {};
  for (const project of config.projects) {
    const manifestPath = path.posix.join(config.outputRoot, project.id, 'manifest.json');
    let manifest;
    try {
      manifest = JSON.parse(await readFile(path.join(root, manifestPath), 'utf8'));
    } catch (error) {
      if (!options.requireAll && error.code === 'ENOENT') continue;
      throw new Error(`[${project.id}] Manifest kunne ikke læses: ${manifestPath}`);
    }
    if (manifest.id !== project.id || manifest.steps?.length !== getExpectedStepCount(project)) {
      throw new Error(`[${project.id}] Manifest stemmer ikke med build-guide-konfigurationen.`);
    }
    const buildSource = manifest.buildSource || {
      type: manifest.source.type,
      path: manifest.source.path,
      ordering: manifest.source.ordering || null,
      note: null,
    };
    const legacySource = manifest.legacySource || (manifest.source.type === 'pptx' ? manifest.source : null);
    guides[project.id] = {
      manifest: manifestPath,
      displayName: project.displayName,
      sourceFileName: project.sourceFileName,
      sourceInternalTitle: project.sourceInternalTitle,
      sourceSha256: manifest.source.sha256,
      outputSha256: manifest.output.sha256,
      buildSource,
      legacySource,
      projectSpecificCodeSource: manifest.projectSpecificCodeSource,
      hasNonBuildPages: Boolean(project.pageSemantics?.some((range) => range.type !== 'build')),
      navigationLabel: project.pageSemantics?.some((range) => range.type !== 'build') ? 'Vælg side' : 'Vælg trin',
      buildSteps: manifest.steps.map((step) => {
        const pageMetadata = resolvePageMetadata(project, step.number, manifest.steps.length);
        return {
          number: step.number,
          ...pageMetadata,
          image: step.path,
          sourceType: step.sourceType || manifest.source.type,
          sourceSlide: step.sourceSlide ?? null,
          sourceMedia: step.sourceMedia ?? null,
          sourceSequence: step.sourceSequence ?? null,
          sourceFile: step.sourceFile ?? null,
          sourcePath: step.sourcePath ?? null,
          sourceSha256: step.sourceSha256 ?? null,
          sourceRepresentation: step.sourceRepresentation,
          width: step.width,
          height: step.height,
          bytes: step.bytes,
          sha256: step.sha256,
          alt: `${project.displayName}: ${pageMetadata.pageLabel}`,
        };
      }),
    };
  }

  const generatedPath = path.join(root, 'src', 'generated', 'build-guides.js');
  const temporaryPath = `${generatedPath}.${process.pid}.tmp`;
  await mkdir(path.dirname(generatedPath), { recursive: true });
  await writeFile(
    temporaryPath,
    `// Generated by scripts/convert-build-guides.mjs. Do not edit manually.\nexport const generatedBuildGuides = ${JSON.stringify(guides, null, 2)};\n`,
    'utf8',
  );
  await rm(generatedPath, { force: true });
  await rename(temporaryPath, generatedPath);
  console.log(`[INDEX] ${Object.keys(guides).length} manifests samlet i ${relative(generatedPath)}.`);
}

export async function replaceDirectoryAtomically(temporaryPath, outputPath, backupPath) {
  await rm(backupPath, { recursive: true, force: true });
  let hadExistingOutput = false;
  try {
    await rename(outputPath, backupPath);
    hadExistingOutput = true;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }

  try {
    await rename(temporaryPath, outputPath);
    if (hadExistingOutput) await rm(backupPath, { recursive: true, force: true });
  } catch (error) {
    if (hadExistingOutput) await rename(backupPath, outputPath);
    throw error;
  }
}

function parseArguments(argumentsList) {
  const options = { projectId: null, analyzeOnly: false, force: false };
  for (let index = 0; index < argumentsList.length; index += 1) {
    const argument = argumentsList[index];
    if (argument === '--project') options.projectId = argumentsList[++index];
    else if (argument === '--analyze-only') options.analyzeOnly = true;
    else if (argument === '--force') options.force = true;
    else throw new Error(`Ukendt argument: ${argument}`);
  }
  if (argumentsList.includes('--project') && !options.projectId) throw new Error('--project kræver et projekt-id.');
  return options;
}

function asArray(value) {
  if (value == null) return [];
  return Array.isArray(value) ? value : [value];
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function relative(filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function assertInsideRoot(candidate, allowedRoot, label) {
  const relativePath = path.relative(allowedRoot, candidate);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Ugyldig ${label} uden for den tilladte rod: ${candidate}`);
  }
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function formatDuration(started) {
  return `${((performance.now() - started) / 1000).toFixed(2)} s`;
}
