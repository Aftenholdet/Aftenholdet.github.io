import { createHash } from 'node:crypto';
import { access, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  codeModeOptions,
  levels,
  libraryCategories,
  libraryAssets,
  libraryTopics,
  platformOptions,
  projects,
} from '../src/content.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const validateSources = process.argv.includes('--sources');

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
check(projects.length === 20, `Forventede præcis 20 projekter, fandt ${projects.length}.`);
uniqueIds(levels, 'Niveauer');
uniqueIds(projects, 'Projekter');
uniqueIds(libraryCategories, 'Bibliotekskategorier');
uniqueIds(libraryTopics, 'Biblioteksemner');

const levelIds = new Set(levels.map((level) => level.id));
const categoryIds = new Set(libraryCategories.map((category) => category.id));
const readyProjects = projects.filter((project) => project.buildStatus === 'ready');
const incompleteProjects = projects.filter((project) => project.buildStatus === 'incomplete');
check(readyProjects.length === 20, `Forventede 20 projekter med byggeguide, fandt ${readyProjects.length}.`);
check(incompleteProjects.length === 0, `Forventede ingen incomplete projekter, fandt ${incompleteProjects.length}.`);
check(projects.reduce((sum, project) => sum + project.buildSteps.length, 0) === 1132, 'Forventede samlet 1.132 genererede byggetrin.');

for (const project of projects) {
  check(levelIds.has(project.levelId), `${project.name} peger på et ukendt niveau.`);
  check(['ready', 'source-only', 'needs-review', 'incomplete'].includes(project.buildStatus), `${project.name} har ukendt buildStatus.`);
  await fileExists(project.thumbnail, `${project.name} thumbnail`);
  check(['pptx', 'image-sequence'].includes(project.buildSource?.type), `${project.name} har ukendt buildSource.`);
  if (validateSources) {
    await fileExists(project.buildSource?.path, `${project.name} build-kilde`);
    if (project.legacySource) await fileExists(project.legacySource.path, `${project.name} legacy-kilde`);
  }
  if (project.buildStatus === 'incomplete') {
    check(project.buildSteps.length === 0, `${project.name} er incomplete, men har byggetrin.`);
    check(project.buildGuideManifest === null, `${project.name} er incomplete, men har et manifest.`);
  }

  const sourceSlides = [];
  const sourceSequences = [];
  const sourceFiles = [];
  const imagePaths = [];
  const instructionNumbers = [];
  for (const [index, step] of project.buildSteps.entries()) {
    check(step.number === index + 1, `${project.name} har ikke sammenhængende trinnumre.`);
    check(['overview', 'materials', 'build', 'finished'].includes(step.pageType), `${project.name} side ${step.number} har ukendt sidetype.`);
    check(typeof step.pageLabel === 'string' && step.pageLabel.length > 0, `${project.name} side ${step.number} mangler elevlabel.`);
    if (step.pageType === 'build') {
      instructionNumbers.push(step.instructionNumber);
      check(step.instructionTotal > 0, `${project.name} side ${step.number} mangler samlet antal instruktioner.`);
    } else {
      check(step.instructionNumber === null, `${project.name} side ${step.number} har et irrelevant instruktionsnummer.`);
    }
    check(step.sourceType === project.buildSource.type, `${project.name} trin ${step.number} har forkert sourceType.`);
    if (step.sourceType === 'pptx') {
      check(step.sourceSlide > 0, `${project.name} trin ${step.number} mangler source slide.`);
      if (index > 0) check(step.sourceSlide > project.buildSteps[index - 1].sourceSlide, `${project.name} har ikke stigende source slide mapping.`);
      sourceSlides.push(step.sourceSlide);
    } else if (step.sourceType === 'image-sequence') {
      check(step.sourceSequence === index + 1, `${project.name} trin ${step.number} har forkert source sequence.`);
      check(Boolean(step.sourceFile && step.sourcePath), `${project.name} trin ${step.number} mangler source-fil.`);
      sourceSequences.push(step.sourceSequence);
      sourceFiles.push(step.sourceFile);
      if (validateSources) await fileExists(step.sourcePath, `${project.name} source image ${step.sourceFile}`);
    }
    check(step.image.endsWith(`/${String(index + 1).padStart(3, '0')}.webp`), `${project.name} trin ${step.number} har forkert filnavn.`);
    imagePaths.push(step.image);
    await fileExists(step.image, `${project.name} trin ${step.number}`);
  }
  check(new Set(sourceSlides).size === sourceSlides.length, `${project.name} har dublerede source slides.`);
  check(new Set(sourceSequences).size === sourceSequences.length, `${project.name} har dublerede source sequence-numre.`);
  check(new Set(sourceFiles).size === sourceFiles.length, `${project.name} har dublerede source-filer.`);
  check(new Set(imagePaths).size === imagePaths.length, `${project.name} har dublerede build-assets.`);
  check(
    JSON.stringify(instructionNumbers) === JSON.stringify(Array.from({ length: instructionNumbers.length }, (_, index) => index + 1)),
    `${project.name} har ikke sammenhængende semantiske instruktionsnumre.`,
  );

  if (project.buildStatus === 'ready') {
    check(Boolean(project.buildGuideManifest), `${project.name} mangler manifestreference.`);
    try {
      const manifest = JSON.parse(await readFile(path.join(root, project.buildGuideManifest), 'utf8'));
      check(manifest.id === project.id, `${project.name}: manifest-id stemmer ikke.`);
      check(manifest.level === project.levelId, `${project.name}: manifest-niveau stemmer ikke.`);
      check(manifest.source.type === project.buildSource.type, `${project.name}: manifest og buildSource har forskellig type.`);
      check(manifest.output.imageCount === project.buildSteps.length, `${project.name}: manifestets billedantal stemmer ikke.`);
      check(manifest.steps.length === project.buildSteps.length, `${project.name}: manifestets trinantal stemmer ikke.`);
      check(JSON.stringify(manifest.buildSteps) === JSON.stringify(imagePaths), `${project.name}: manifest og content-model har forskellige assets.`);
      if (manifest.pageSemantics) {
        check(
          JSON.stringify(manifest.steps.map((step) => step.pageLabel)) === JSON.stringify(project.buildSteps.map((step) => step.pageLabel)),
          `${project.name}: manifest og content-model har forskellige sidelabels.`,
        );
      }
      if (project.buildSource.type === 'pptx') {
        check(JSON.stringify(manifest.steps.map((step) => step.sourceSlide)) === JSON.stringify(sourceSlides), `${project.name}: manifest og content-model har forskellig slide mapping.`);
      } else {
        check(manifest.source.imageCount === project.buildSteps.length, `${project.name}: image-sequence-antallet stemmer ikke.`);
        check(manifest.buildSource.path === project.buildSource.path, `${project.name}: manifest og content-model har forskellig buildSource.`);
        check(manifest.legacySource?.type === 'pptx', `${project.name}: legacy-PPTX mangler i manifestet.`);
        check(JSON.stringify(manifest.steps.map((step) => step.sourceSequence)) === JSON.stringify(sourceSequences), `${project.name}: manifest og content-model har forskellig sequence mapping.`);
        check(JSON.stringify(manifest.steps.map((step) => step.sourceFile)) === JSON.stringify(sourceFiles), `${project.name}: manifest og content-model har forskellige source-filer.`);
      }
      for (const step of manifest.steps) {
        const file = await stat(path.join(root, step.path));
        check(file.size === step.bytes, `${project.name} trin ${step.number}: filstørrelsen stemmer ikke med manifestet.`);
        const outputHash = createHash('sha256').update(await readFile(path.join(root, step.path))).digest('hex');
        check(outputHash === step.sha256, `${project.name} trin ${step.number}: output-hash stemmer ikke.`);
        if (validateSources && step.sourceType === 'image-sequence') {
          const sourceHash = createHash('sha256').update(await readFile(path.join(root, step.sourcePath))).digest('hex');
          check(sourceHash === step.sourceSha256, `${project.name} trin ${step.number}: source-hash stemmer ikke.`);
        }
      }
    } catch (error) {
      errors.push(`${project.name}: manifest kunne ikke valideres (${error.message}).`);
    }
  }
}

for (const topic of libraryTopics) {
  check(categoryIds.has(topic.categoryId), `${topic.name} peger på en ukendt kategori.`);
  if (validateSources) await fileExists(topic.source.path, `${topic.name} kilde`);
  check(Array.isArray(topic.sections) && topic.sections.length > 0, `${topic.name} mangler afsnit.`);
  uniqueIds(topic.sections, `${topic.name} afsnit`);
  for (const section of topic.sections) {
    const selection = section.selection;
    check(Boolean(selection), `${topic.name}/${section.name} mangler selector-konfiguration.`);
    check(selection.platforms.every((id) => platformOptions.some((option) => option.id === id)), `${topic.name}/${section.name} har ukendt platform.`);
    check(selection.codeModes.every((id) => codeModeOptions.some((option) => option.id === id)), `${topic.name}/${section.name} har ukendt kodetype.`);
    check(Array.isArray(section.variants) && section.variants.length > 0, `${topic.name}/${section.name} mangler varianter.`);
    for (const variant of section.variants) {
      check(['spike', 'mindstorms', 'shared', 'general'].includes(variant.platform), `${topic.name}/${section.name} har ugyldig variantplatform.`);
      check(['blocks', 'text', 'concept'].includes(variant.codeMode), `${topic.name}/${section.name} har ugyldig kodetype.`);
      check(['available', 'coming-soon', 'missing'].includes(variant.status), `${topic.name}/${section.name} har ugyldig status.`);
      check(['confirmed', 'likely', 'unknown'].includes(variant.confidence), `${topic.name}/${section.name} har ugyldig confidence.`);
      check(Boolean(variant.source?.pptx && Array.isArray(variant.source.slideNumbers) && Array.isArray(variant.source.mediaFiles)), `${topic.name}/${section.name} mangler kildemetadata.`);
      check(Array.isArray(variant.content), `${topic.name}/${section.name} mangler content-listen.`);
      for (const content of variant.content || []) {
        if (content.type === 'image') check(Boolean(libraryAssets[content.assetId]), `${topic.name}/${section.name} peger på ukendt asset ${content.assetId}.`);
        if (content.type === 'code') check(typeof content.text === 'string' && content.text.length > 0, `${topic.name}/${section.name} har tom tekstkode.`);
      }
    }
  }
}

for (const [id, asset] of Object.entries(libraryAssets)) {
  await fileExists(asset.src, `Biblioteksasset ${id}`);
}

if (errors.length) {
  console.error(`Indholdsvalidering fejlede med ${errors.length} fejl:`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exitCode = 1;
} else {
  const scope = validateSources ? 'Runtime- og source-indhold' : 'Runtime-indhold';
  console.log(`${scope} OK: ${levels.length} niveauer, ${projects.length} projekter, ${libraryTopics.length} biblioteksemner.`);
}
