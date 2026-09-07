import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeImageSequence } from './convert-build-guides.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const legacyRoot = 'Old Solution (Google Drive)';
const imageRoot = 'source-assets';
const outputPath = path.join(root, 'docs', 'source-archive-manifest.json');
const config = JSON.parse(await readFile(path.join(root, 'content', 'build-guides.config.json'), 'utf8'));

const legacyFiles = await findFiles(path.join(root, legacyRoot));
if (legacyFiles.length !== 32) throw new Error(`Forventede 32 legacy-filer, fandt ${legacyFiles.length}.`);
if (legacyFiles.some((file) => path.extname(file).toLowerCase() !== '.pptx')) {
  throw new Error('Legacy-arkivet indeholder andet end PPTX-filer.');
}

const legacyEntries = [];
for (const absolutePath of legacyFiles) {
  const buffer = await readFile(absolutePath);
  const relativePath = relative(absolutePath);
  legacyEntries.push({
    path: relativePath,
    fileName: path.basename(absolutePath),
    bytes: buffer.byteLength,
    sha256: sha256(buffer),
  });
}
legacyEntries.sort((left, right) => compareText(left.path, right.path));

const imageProjects = config.projects
  .filter((project) => project.sourceType === 'image-sequence')
  .sort((left, right) => compareText(left.id, right.id));
if (imageProjects.length !== 2 || imageProjects.map((project) => project.id).join(',') !== 'gaffeltruck,mecha-bot') {
  throw new Error('Forventede image-sequence-kilderne gaffeltruck og mecha-bot.');
}

const imageSequences = [];
const coveredImageFiles = new Set();
for (const project of imageProjects) {
  const source = await analyzeImageSequence(path.join(root, project.source), project);
  const files = source.entries.map((entry) => {
    const sourcePath = path.posix.join(project.source, entry.fileName);
    coveredImageFiles.add(sourcePath);
    return {
      sequence: entry.sequence,
      fileName: entry.fileName,
      path: sourcePath,
      bytes: entry.bytes,
      sha256: entry.sha256,
    };
  });
  imageSequences.push({
    projectId: project.id,
    displayName: project.displayName,
    role: 'authoritative-build-source',
    sourceDir: project.source,
    fileCount: files.length,
    fileNamePattern: project.sequencePattern,
    ordering: project.ordering,
    totalBytes: source.totalBytes,
    combinedSha256: source.sha256,
    legacySource: project.legacySource,
    buildSourceNote: project.buildSourceNote,
    files,
  });
}

const allImageFiles = (await findFiles(path.join(root, imageRoot))).map(relative).sort(compareText);
if (allImageFiles.length !== 168) throw new Error(`Forventede 168 source-assets, fandt ${allImageFiles.length}.`);
const uncovered = allImageFiles.filter((file) => !coveredImageFiles.has(file));
const missing = [...coveredImageFiles].filter((file) => !allImageFiles.includes(file));
if (uncovered.length || missing.length) {
  throw new Error(`Source coverage fejlede. Ikke dækket: ${uncovered.join(', ') || 'ingen'}. Mangler: ${missing.join(', ') || 'ingen'}.`);
}

const manifest = {
  schemaVersion: 1,
  hashAlgorithm: 'sha256',
  deploymentRequired: false,
  legacyArchive: {
    root: legacyRoot,
    role: 'legacy-and-master-source-archive',
    fileCount: legacyEntries.length,
    totalBytes: legacyEntries.reduce((sum, entry) => sum + entry.bytes, 0),
    combinedSha256: hashEntries(legacyEntries),
    files: legacyEntries,
  },
  imageSequences,
  coverage: {
    legacyFiles: legacyEntries.length,
    imageSequenceFiles: coveredImageFiles.size,
    totalSourceFiles: legacyEntries.length + coveredImageFiles.size,
    complete: true,
  },
};

await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Source-manifest OK: ${legacyEntries.length} PPTX + ${coveredImageFiles.size} PNG.`);
console.log(`Skrevet: ${relative(outputPath)}`);

async function findFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findFiles(entryPath));
    else if (entry.isFile()) found.push(entryPath);
  }
  return found;
}

function hashEntries(entries) {
  const hash = createHash('sha256');
  for (const entry of entries) hash.update(`${entry.path}\0${entry.bytes}\0${entry.sha256}\n`);
  return hash.digest('hex');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function relative(value) {
  return path.relative(root, value).split(path.sep).join('/');
}

function compareText(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}
