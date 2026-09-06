import { access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  codeModeOptions,
  levels,
  libraryCategories,
  libraryTopics,
  platformOptions,
  projects,
} from '../src/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

function uniqueIds(entries, label) {
  const ids = entries.map((entry) => entry.id);
  check(new Set(ids).size === ids.length, `${label} indeholder dublerede id'er.`);
  entries.forEach((entry) => check(Boolean(entry.id && entry.name), `${label} mangler id eller navn.`));
}

async function fileExists(relativePath, label) {
  try {
    await access(path.join(root, relativePath));
  } catch {
    errors.push(`${label} findes ikke: ${relativePath}`);
  }
}

check(levels.length === 4, `Forventede 4 niveauer, fandt ${levels.length}.`);
uniqueIds(levels, 'Niveauer');
uniqueIds(projects, 'Projekter');
uniqueIds(libraryCategories, 'Bibliotekskategorier');
uniqueIds(libraryTopics, 'Biblioteksemner');

const levelIds = new Set(levels.map((level) => level.id));
const categoryIds = new Set(libraryCategories.map((category) => category.id));

for (const project of projects) {
  check(levelIds.has(project.levelId), `${project.name} peger på et ukendt niveau.`);
  check(['ready', 'source-only', 'needs-review'].includes(project.buildStatus), `${project.name} har ukendt buildStatus.`);
  await fileExists(project.thumbnail, `${project.name} thumbnail`);
  await fileExists(project.source.path, `${project.name} kilde`);
  for (const [index, step] of project.buildSteps.entries()) {
    check(step.number === index + 1, `${project.name} har ikke sammenhængende trinnumre.`);
    await fileExists(step.image, `${project.name} trin ${step.number}`);
  }
}

for (const topic of libraryTopics) {
  check(categoryIds.has(topic.categoryId), `${topic.name} peger på en ukendt kategori.`);
  await fileExists(topic.source.path, `${topic.name} kilde`);
  for (const platform of platformOptions) {
    check(Boolean(topic.variants[platform.id]), `${topic.name} mangler platformen ${platform.id}.`);
    for (const mode of codeModeOptions) {
      const variant = topic.variants[platform.id]?.[mode.id];
      check(Boolean(variant?.status), `${topic.name} mangler varianten ${platform.id}/${mode.id}.`);
    }
  }
}

if (errors.length) {
  console.error(`Indholdsvalidering fejlede med ${errors.length} fejl:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  console.log(`Indhold OK: ${levels.length} niveauer, ${projects.length} projekter, ${libraryTopics.length} biblioteksemner.`);
}

