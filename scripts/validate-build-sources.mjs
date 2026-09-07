import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { analyzeImageSequence } from './convert-build-guides.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = JSON.parse(await readFile(path.join(root, 'content', 'build-guides.config.json'), 'utf8'));
const projects = config.projects.filter((project) => project.sourceType === 'image-sequence');

if (!projects.length) throw new Error('Ingen image-sequence-kilder er konfigureret.');

let total = 0;
for (const project of projects) {
  const sourcePath = path.resolve(root, project.source);
  const relativePath = path.relative(root, sourcePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`[${project.id}] Source directory ligger uden for repository.`);
  }
  const source = await analyzeImageSequence(sourcePath, project);
  total += source.entries.length;
  console.log(
    `[OK] ${project.id}: ${source.entries.length} PNG-filer, ` +
    `${source.entries[0].sequence}-${source.entries.at(-1).sequence}, SHA-256 ${source.sha256.slice(0, 12)}…`,
  );
}

console.log(`Image-sequence-kilder OK: ${projects.length} projekter, ${total} billeder.`);
