import { createHash } from 'node:crypto';
import {
  access,
  mkdir,
  readFile,
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

const PIPELINE_VERSION = 1;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const configPath = path.join(root, 'content', 'build-guides.config.json');
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: false,
  isArray: (name) => name === 'Relationship' || name === 'p:sldId',
});

main().catch((error) => {
  console.error(`[ERROR] ${error.message}`);
  if (process.env.DEBUG_PIPELINE) console.error(error.stack);
  process.exitCode = 1;
});

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const config = JSON.parse(await readFile(configPath, 'utf8'));
  const selectedProjects = options.projectId
    ? config.projects.filter((project) => project.id === options.projectId)
    : config.projects;

  if (!selectedProjects.length) {
    throw new Error(`Projektet "${options.projectId}" findes ikke i ${relative(configPath)}.`);
  }

  for (const project of selectedProjects) {
    await processProject(project, config, options);
  }
}

async function processProject(project, config, options) {
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
    pipelineVersion: PIPELINE_VERSION,
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
  printAnalysis(project, presentation);

  if (options.analyzeOnly) {
    console.log(`[DONE] Analyse afsluttet uden at skrive output (${formatDuration(started)}).`);
    return;
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
      validateExtractableSlide(project, analysis);
      const mediaPath = analysis.images[0].path;
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
      name: project.name,
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
      },
      conversion: {
        pipelineVersion: PIPELINE_VERSION,
        strategy: project.strategy,
        ...settings,
      },
      excludedSlides: project.excludedSlides,
      sequenceNotes: project.sequenceNotes,
      slideAnalysis: presentation.slides.map((slide) => ({
        slide: slide.number,
        included: project.includeSlides.includes(slide.number),
        classification: project.excludedSlides.find((entry) => entry.slide === slide.number)?.classification || 'build-step',
        text: slide.text,
        pictureCount: slide.pictureCount,
        shapeCount: slide.shapeCount,
        graphicFrameCount: slide.graphicFrameCount,
        imageTitles: slide.imageTitles,
      })),
      buildSteps: steps.map((step) => step.path),
      steps,
      output: {
        imageCount: steps.length,
        totalBytes,
      },
    };

    await writeFile(path.join(temporaryPath, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await replaceDirectoryAtomically(temporaryPath, outputPath, backupPath);
    console.log(`[DONE] ${steps.length} billeder, ${formatBytes(totalBytes)}, ${formatDuration(started)}.`);
    console.log(`       ${relative(outputPath)}`);
  } catch (error) {
    await rm(temporaryPath, { recursive: true, force: true });
    throw error;
  }
}

function analyzePresentation(archive) {
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

function analyzeSlide(archive, slidePath, number) {
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
  const images = collected.imageRelationshipIds.map((relationshipId) => {
    const relationship = relationshipMap.get(relationshipId);
    if (!relationship || !String(relationship['@_Type']).endsWith('/image')) {
      throw new Error(`Slide ${number}: billedrelationen ${relationshipId} blev ikke fundet.`);
    }
    return {
      relationshipId,
      path: path.posix.normalize(path.posix.join(path.posix.dirname(slidePath), relationship['@_Target'])),
    };
  });

  return {
    number,
    slidePath,
    text: collected.text.join(' ').replace(/\s+/g, ' ').trim(),
    imageTitles: collected.imageTitles,
    images,
    pictureCount: collected.pictureCount,
    shapeCount: collected.shapeCount,
    graphicFrameCount: collected.graphicFrameCount,
    connectorCount: collected.connectorCount,
  };
}

function collectSlideContent(document) {
  const result = {
    text: [],
    imageTitles: [],
    imageRelationshipIds: [],
    pictureCount: 0,
    shapeCount: 0,
    graphicFrameCount: 0,
    connectorCount: 0,
  };

  function visit(node, key = '') {
    if (Array.isArray(node)) {
      node.forEach((item) => visit(item, key));
      return;
    }
    if (!node || typeof node !== 'object') {
      if (key === 'a:t' && node != null) result.text.push(String(node));
      return;
    }

    if (key === 'p:pic') result.pictureCount += 1;
    if (key === 'p:sp') result.shapeCount += 1;
    if (key === 'p:graphicFrame') result.graphicFrameCount += 1;
    if (key === 'p:cxnSp') result.connectorCount += 1;
    if (key === 'a:blip' && node['@_r:embed']) result.imageRelationshipIds.push(node['@_r:embed']);
    if (key === 'p:cNvPr' && node['@_title']) result.imageTitles.push(node['@_title']);

    for (const [childKey, child] of Object.entries(node)) visit(child, childKey);
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
}

function validateExtractableSlide(project, slide) {
  const issues = [];
  if (project.strategy !== 'extract-single-slide-image') issues.push(`ukendt strategi ${project.strategy}`);
  if (slide.pictureCount !== 1 || slide.images.length !== 1) issues.push(`${slide.images.length} billedrelationer/${slide.pictureCount} billedobjekter`);
  if (slide.text) issues.push(`tekstlaget "${slide.text.slice(0, 80)}"`);
  if (slide.shapeCount) issues.push(`${slide.shapeCount} tekst-/formobjekter`);
  if (slide.graphicFrameCount) issues.push(`${slide.graphicFrameCount} diagram-/tabelobjekter`);
  if (slide.connectorCount) issues.push(`${slide.connectorCount} forbindelseslinjer`);
  if (issues.length) {
    throw new Error(
      `[${project.id}] Slide ${slide.number} kan ikke udtrækkes sikkert som ét billede: ${issues.join(', ')}. ` +
      'Brug en fuld PPTX-renderer eller gennemgå slidevalget.',
    );
  }
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

async function outputIsCurrent(outputPath, buildKey, expectedCount) {
  try {
    const manifest = JSON.parse(await readFile(path.join(outputPath, 'manifest.json'), 'utf8'));
    if (manifest.buildKey !== buildKey || manifest.steps?.length !== expectedCount) return false;
    for (const step of manifest.steps) {
      const fileStats = await stat(path.join(root, step.path));
      if (!fileStats.isFile() || fileStats.size !== step.bytes) return false;
    }
    return true;
  } catch {
    return false;
  }
}

async function replaceDirectoryAtomically(temporaryPath, outputPath, backupPath) {
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
