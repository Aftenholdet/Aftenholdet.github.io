import { generatedBuildGuides } from './generated/build-guides.js';

const projectAsset = (id, file = 'thumbnail.png') => `assets/projects/${id}/${file}`;

export const levels = [
  {
    id: 'nybegynder',
    name: 'Nybegynder',
    order: 1,
    description: 'Kom godt i gang med overskuelige robotter og tydelige byggeforløb.',
    featuredProjectId: 'breakdancer',
  },
  {
    id: 'let-oevet',
    name: 'Let Øvet',
    order: 2,
    description: 'Byg robotter med flere dele, bevægelser og mekaniske løsninger.',
    featuredProjectId: 'danse-krabbe',
  },
  {
    id: 'oevet',
    name: 'Øvet',
    order: 3,
    description: 'Arbejd med større modeller og mere avancerede konstruktioner.',
    featuredProjectId: 'cnc-tegnemaskine',
  },
  {
    id: 'avanceret',
    name: 'Avanceret',
    order: 4,
    description: 'Gå i dybden med Teknologiskolens mest omfattende robotbyggeri.',
    featuredProjectId: 'stor-robot-arm',
  },
];

export const projects = [
  project('breakdancer', 'Breakdancer', 'nybegynder', 36, '1. Nybegynder/Breakdancer.pptx', {
    note: '34 byggetrin er genereret fra slide 3-36. Præsentationens cover og titelslide er dokumenteret, men ikke talt som byggetrin.',
  }),
  project('fodboldspiller', 'Fodboldspiller', 'nybegynder', 57, '1. Nybegynder/Fodboldspiller.pptx'),
  project('graeshoppe', 'Græshoppe', 'nybegynder', 24, '1. Nybegynder/Græshoppe.pptx'),
  project('gaa-bot', 'Gå-bot', 'nybegynder', 18, '1. Nybegynder/Gå-bot.pptx'),
  project('minigolf', 'Minigolf', 'nybegynder', 27, '1. Nybegynder/Minigolf.pptx'),

  project('danse-krabbe', 'Danse-Krabbe', 'let-oevet', 58, '2. Let Øvet/Danse-Krabbe.pptx'),
  project('farvesorteringsmaskine-let', 'Farvesorteringsmaskine', 'let-oevet', 39, '2. Let Øvet/Farvesorteringsmaskine.pptx', {
    issues: ['Præsentationens interne titel er "Kortdeler" og skal kontrolleres før konvertering.'],
  }),
  project('gribearme', 'Gribearme', 'let-oevet', 68, '2. Let Øvet/Gribearme.pptx'),
  project('grundmodel-1', 'Grundmodel 1', 'let-oevet', 36, '2. Let Øvet/Grundmodel 1.pptx'),
  project('kortdeler', 'Kortdeler', 'let-oevet', 52, '2. Let Øvet/Kortdeler.pptx'),
  project('naesehorn', 'Næsehorn', 'let-oevet', 29, '2. Let Øvet/Næsehorn.pptx'),
  project('robot-arm', 'Robot Arm', 'let-oevet', 52, '2. Let Øvet/Robot Arm.pptx'),

  project('cnc-tegnemaskine', 'CNC-Tegnemaskine', 'oevet', 64, '3. Øvet/CNC-Tegnemaskine.pptx'),
  project('farvesorteringsmaskine-oevet', 'Farvesorteringsmaskine', 'oevet', 90, '3. Øvet/Farvesorteringsmaskine.pptx', {
    issues: ['Præsentationens interne titel er "Sorteringsmaskine".'],
  }),
  project('gaffeltruck', 'Gaffeltruck', 'oevet', 82, '3. Øvet/Gaffeltruck.pptx'),
  project('grundmodel-2', 'Grundmodel 2', 'oevet', 76, '3. Øvet/Grundmodel 2.pptx'),
  project('guitar', 'Guitar', 'oevet', 54, '3. Øvet/Guitar.pptx'),
  project('mecha-bot', 'Mecha-bot', 'oevet', 2, '3. Øvet/Mecha-bot.pptx'),
  project('rul-bot', 'Rul-Bot', 'oevet', 50, '3. Øvet/Rul-Bot.pptx'),

  project('stor-robot-arm', 'Stor Robot Arm', 'avanceret', 177, '4. Avanceret/Stor Robot Arm.pptx', {
    issues: ['Præsentationens interne titel er "Arm".'],
  }),
];

function project(id, name, levelId, sourceSlideCount, sourcePath, options = {}) {
  const generatedGuide = generatedBuildGuides[id] || null;
  const legacySource = generatedGuide?.legacySource || {
    type: 'pptx',
    path: `Old Solution (Google Drive)/Differentieret Læring/${sourcePath}`,
    fileName: sourcePath.split('/').at(-1),
    internalTitle: options.sourceInternalTitle ?? null,
    slideCount: sourceSlideCount,
  };
  const buildSource = generatedGuide?.buildSource || legacySource;
  return {
    id,
    name,
    displayName: name,
    levelId,
    thumbnail: projectAsset(id),
    source: buildSource,
    buildSource,
    legacySource,
    buildStatus: generatedGuide ? 'ready' : (options.buildStatus ?? 'source-only'),
    buildGuideManifest: generatedGuide?.manifest ?? null,
    buildSteps: generatedGuide?.buildSteps ?? [],
    hasNonBuildPages: generatedGuide?.hasNonBuildPages ?? false,
    navigationLabel: generatedGuide?.navigationLabel ?? 'Vælg trin',
    projectSpecificCodeSource: generatedGuide?.projectSpecificCodeSource ?? null,
    note: options.note ?? '',
    issues: options.issues ?? [],
  };
}

export function getLevel(id) {
  return levels.find((level) => level.id === id);
}

export function getProject(id) {
  return projects.find((projectEntry) => projectEntry.id === id);
}

export function getProjectsForLevel(levelId) {
  return projects.filter((projectEntry) => projectEntry.levelId === levelId);
}

export {
  codeModeOptions,
  findAvailableAlternative,
  getLibrarySection,
  getLibraryTopic,
  getSectionSelection,
  libraryAssets,
  libraryCategories,
  libraryTopics,
  platformOptions,
  resolveLibraryVariant,
} from './library-content.js';
