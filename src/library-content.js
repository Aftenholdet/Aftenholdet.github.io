import { librarySlideContent } from './generated/library-slide-content.js';

export const libraryCategories = [
  { id: 'sensorer', name: 'Sensorer' },
  { id: 'motor', name: 'Motor og bevægelse' },
  { id: 'programlogik', name: 'Programlogik' },
  { id: 'hub', name: 'Hub og styring' },
];

export const platformOptions = [
  { id: 'spike', label: 'SPIKE' },
  { id: 'mindstorms', label: 'MINDSTORMS' },
];

export const codeModeOptions = [
  { id: 'blocks', label: 'Blokke' },
  { id: 'text', label: 'Tekst' },
];

export const libraryAssets = {
  'asynkrone-traade': blockAsset(
    'assets/generated/library/blocks/asynkrone-traade.webp',
    'Fire gule startblokke til parallelle processer',
    'Asynkrone Tråde.pptx',
    1,
    'ppt/media/image1.png',
  ),
  gentag: blockAsset(
    'assets/generated/library/blocks/gentag.webp',
    'Blokke til at gentage 10 gange, gentage indtil og gentage for evigt',
    'Gentag.pptx',
    1,
    'ppt/media/image3.png',
  ),
  'hvis-ellers': blockAsset(
    'assets/generated/library/blocks/hvis-ellers.webp',
    'En hvis-ellers-blok med plads til en betingelse og handlinger',
    'Hvis ... Ellers.pptx',
    1,
    'ppt/media/image4.png',
  ),
  vent: blockAsset(
    'assets/generated/library/blocks/vent.webp',
    'Blokkene vent et antal sekunder og vent indtil',
    'Vent.pptx',
    1,
    'ppt/media/image3.png',
  ),
};

const bothPlatforms = ['spike', 'mindstorms'];
const bothCodeModes = ['blocks', 'text'];

export const libraryTopics = [
  topic('afstandssensor', 'Afstandssensor', 'sensorer', 'Mål afstand og styr sensorens fire lys.', 'Afstandssensor.pptx', 12, [
    section('maal-afstand', 'Mål afstand', standardSelection(), [
      missingVariant('spike', 'blocks', 'Afstandssensor.pptx'),
      textVariant('spike', 'Afstandssensor.pptx', [4, 5]),
      missingVariant('mindstorms', 'blocks', 'Afstandssensor.pptx'),
      textVariant('mindstorms', 'Afstandssensor.pptx', [6, 7]),
    ]),
    section('sensorlys', 'Tænd/sluk for lys', standardSelection(), [
      missingVariant('spike', 'blocks', 'Afstandssensor.pptx'),
      textVariant('spike', 'Afstandssensor.pptx', [9, 10]),
      missingVariant('mindstorms', 'blocks', 'Afstandssensor.pptx'),
      textVariant('mindstorms', 'Afstandssensor.pptx', [11, 12]),
    ]),
  ]),

  topic('farvesensor', 'Farvesensor', 'sensorer', 'Læs den farve, sensoren ser.', 'Farvesensor.pptx', 7, [
    section('maal-farve', 'Mål farve', standardSelection(), [
      missingVariant('spike', 'blocks', 'Farvesensor.pptx'),
      textVariant('spike', 'Farvesensor.pptx', [4, 5]),
      missingVariant('mindstorms', 'blocks', 'Farvesensor.pptx'),
      textVariant('mindstorms', 'Farvesensor.pptx', [6, 7]),
    ]),
  ]),

  topic('kraftsensor', 'Kraftsensor', 'sensorer', 'Registrér tryk og hvor hårdt sensoren trykkes.', 'Kraftsensor.pptx', 12, [
    section('er-trykket', 'Er knappen trykket?', standardSelection(), [
      missingVariant('spike', 'blocks', 'Kraftsensor.pptx'),
      textVariant('spike', 'Kraftsensor.pptx', [4, 5]),
      missingVariant('mindstorms', 'blocks', 'Kraftsensor.pptx'),
      textVariant('mindstorms', 'Kraftsensor.pptx', [6, 7]),
    ]),
    section('maal-kraft', 'Hvor meget er knappen trykket?', standardSelection(), [
      missingVariant('spike', 'blocks', 'Kraftsensor.pptx'),
      textVariant('spike', 'Kraftsensor.pptx', [9, 10]),
      missingVariant('mindstorms', 'blocks', 'Kraftsensor.pptx'),
      textVariant('mindstorms', 'Kraftsensor.pptx', [11, 12]),
    ]),
  ]),

  topic('motor', 'Motor', 'motor', 'Kør en motor med hastighed, grader eller position.', 'Motor.pptx', 17, [
    motorSection('koer-retning', 'Kør motor i retning', [4, 5], [6]),
    motorSection('koer-grader', 'Kør motor X grader i retning', [8, 9], [10]),
    motorSection('koer-position', 'Kør motor til position i retning', [12, 13], [14]),
    section('to-motorer', 'Kør to motorer samtidig', standardSelection(), [
      missingVariant('spike', 'blocks', 'Motor.pptx'),
      textVariant('spike', 'Motor.pptx', [16]),
      missingVariant('mindstorms', 'blocks', 'Motor.pptx'),
      missingVariant('mindstorms', 'text', 'Motor.pptx', [17]),
    ]),
  ]),

  topic('vent', 'Vent', 'programlogik', 'Vent et bestemt tidsrum eller indtil noget sker.', 'Vent.pptx', 7, [
    section('sekunder', 'Vent X sekunder', standardSelection(), [
      sharedBlockVariant('vent', 'Vent.pptx'),
      textVariant('spike', 'Vent.pptx', [3]),
      textVariant('mindstorms', 'Vent.pptx', [4]),
    ]),
    section('indtil', 'Vent indtil', standardSelection(), [
      sharedBlockVariant('vent', 'Vent.pptx'),
      textVariant('spike', 'Vent.pptx', [6]),
      textVariant('mindstorms', 'Vent.pptx', [7]),
    ]),
  ]),

  topic('gentag', 'Gentag', 'programlogik', 'Gentag kode et antal gange, indtil noget sker eller for evigt.', 'Gentag.pptx', 11, [
    repeatSection('gange', 'Gentag 10 gange', [4], [5]),
    repeatSection('indtil', 'Gentag indtil X', [7], [8]),
    repeatSection('for-evigt', 'Gentag for evigt', [10], [11]),
  ]),

  topic('hvis-ellers', 'Hvis ... Ellers', 'programlogik', 'Lad programmet vælge mellem forskellige handlinger.', 'Hvis ... Ellers.pptx', 8, [
    section('hvis-ellers', 'Hvis ... Ellers', standardSelection(), [
      sharedBlockVariant('hvis-ellers', 'Hvis ... Ellers.pptx'),
      textVariant('spike', 'Hvis ... Ellers.pptx', [4]),
      textVariant('mindstorms', 'Hvis ... Ellers.pptx', [5]),
    ]),
    section('ellers-hvis', 'Hvis ... Ellers hvis ... Ellers', standardSelection(), [
      missingVariant('spike', 'blocks', 'Hvis ... Ellers.pptx'),
      textVariant('spike', 'Hvis ... Ellers.pptx', [7]),
      missingVariant('mindstorms', 'blocks', 'Hvis ... Ellers.pptx'),
      textVariant('mindstorms', 'Hvis ... Ellers.pptx', [8]),
    ]),
  ]),

  topic('mapping', 'Mapping', 'programlogik', 'Forstå hvordan én talværdi kan omregnes til et andet interval.', 'Mapping.pptx', 4, [
    section('forklaring', 'Hvad er mapping?', conceptSelection(), [
      conceptVariant('Mapping.pptx', [3, 4]),
    ]),
  ]),

  topic('asynkrone-traade', 'Asynkrone Tråde', 'programlogik', 'Kør flere uafhængige processer i samme program.', 'Asynkrone Tråde.pptx', 4, [
    section('flere-processer', 'Kør flere uafhængige processer', standardSelection(), [
      sharedBlockVariant('asynkrone-traade', 'Asynkrone Tråde.pptx', 'unknown'),
      textVariant('spike', 'Asynkrone Tråde.pptx', [3, 4]),
      missingVariant('mindstorms', 'text', 'Asynkrone Tråde.pptx'),
    ]),
  ]),

  topic('hub-spike-prime', 'Hub SPIKE Prime', 'hub', 'Brug lysmatrix, knaplys og højttaler på SPIKE-hubben.', 'Hub Spike Prime.pptx', 12, [
    hubSpikeSection('matrix-tekst', 'Vis tekst på lysmatrixen', [4]),
    hubSpikeSection('matrix-billeder', 'Vis billeder på lysmatrixen', [6]),
    hubSpikeSection('matrix-pixels', 'Styr enkelte pixels', [8]),
    hubSpikeSection('knaplys', 'Skift knaplyset', [10]),
    hubSpikeSection('hoejttaler', 'Brug højttaleren', [12]),
  ]),

  topic('hub-mindstorms', 'Hub Mindstorms', 'hub', 'Materiale til LEGO Inventor Hub, fjernstyring og controllere.', 'Hub Mindstorm.pptx', 11, [
    comingSoonSection('tastatur', 'Fjernstyring med tastatur', 5),
    comingSoonSection('ps4', 'Fjernstyring med PS4-controller', 7),
    comingSoonSection('xbox', 'Fjernstyring med XBOX-controller', 9),
    comingSoonSection('app', 'Fjernstyring med app-kontrolpanel', 11),
  ]),
];

export function getLibraryTopic(id) {
  return libraryTopics.find((topicEntry) => topicEntry.id === id);
}

export function getLibrarySection(topicEntry, sectionId) {
  return topicEntry?.sections.find((sectionEntry) => sectionEntry.id === sectionId) || topicEntry?.sections[0] || null;
}

export function getSectionSelection(sectionEntry) {
  return sectionEntry?.selection || conceptSelection();
}

export function resolveLibraryVariant(sectionEntry, selectedPlatform, selectedCodeMode) {
  const selection = getSectionSelection(sectionEntry);
  const platform = selection.platforms.length === 1
    ? selection.platforms[0]
    : selection.platforms.includes(selectedPlatform) ? selectedPlatform : selection.fixedPlatform;
  const codeMode = selection.codeModes.length === 1
    ? selection.codeModes[0]
    : selection.codeModes.includes(selectedCodeMode) ? selectedCodeMode : selection.fixedCodeMode;
  const general = sectionEntry.variants.find((entry) => entry.platform === 'general' && entry.codeMode === 'concept');
  if (general && !selection.platforms.length && !selection.codeModes.length) {
    return { variant: general, platform: 'general', codeMode: 'concept', match: 'general' };
  }
  const exact = sectionEntry.variants.find((entry) => entry.platform === platform && entry.codeMode === codeMode);
  if (exact) return { variant: exact, platform, codeMode, match: 'exact' };
  const shared = sectionEntry.variants.find((entry) => entry.platform === 'shared' && entry.codeMode === codeMode);
  if (shared) return { variant: shared, platform, codeMode, match: 'shared' };
  return { variant: null, platform, codeMode, match: 'none' };
}

export function findAvailableAlternative(sectionEntry, selectedPlatform, selectedCodeMode) {
  const selection = getSectionSelection(sectionEntry);
  const current = resolveLibraryVariant(sectionEntry, selectedPlatform, selectedCodeMode);
  const candidates = [];
  for (const codeMode of selection.codeModes) candidates.push({ platform: current.platform, codeMode });
  for (const platform of selection.platforms) candidates.push({ platform, codeMode: current.codeMode });
  for (const platform of selection.platforms) {
    for (const codeMode of selection.codeModes) candidates.push({ platform, codeMode });
  }
  for (const candidate of candidates) {
    if (candidate.platform === current.platform && candidate.codeMode === current.codeMode) continue;
    const resolved = resolveLibraryVariant(sectionEntry, candidate.platform, candidate.codeMode);
    if (resolved.variant?.status === 'available') return candidate;
  }
  return null;
}

function topic(id, name, categoryId, description, pptx, slideCount, sections) {
  return {
    id,
    name,
    categoryId,
    description,
    source: { pptx, path: sourcePath(pptx), slideCount },
    sections,
  };
}

function section(id, name, selection, variants) {
  return { id, name, selection, variants };
}

function standardSelection() {
  return { platforms: bothPlatforms, codeModes: bothCodeModes };
}

function conceptSelection() {
  return { platforms: [], codeModes: [], fixedPlatform: 'general', fixedCodeMode: 'concept' };
}

function singlePlatformSelection(platform) {
  return { platforms: [platform], codeModes: bothCodeModes, fixedPlatform: platform };
}

function textVariant(platform, pptx, slideNumbers) {
  return variant({
    platform,
    codeMode: 'text',
    status: 'available',
    confidence: 'confirmed',
    source: variantSource(pptx, slideNumbers),
    content: slideNumbers.map((slideNumber) => ({
      type: 'code',
      ...librarySlideContent[pptx][slideNumber],
    })),
  });
}

function sharedBlockVariant(assetId, pptx, confidence = 'likely') {
  const asset = libraryAssets[assetId];
  return variant({
    platform: 'shared',
    codeMode: 'blocks',
    status: 'available',
    confidence,
    source: variantSource(pptx, [asset.source.sourceSlide], [asset.source.sourceMedia]),
    content: [{ type: 'image', assetId }],
  });
}

function conceptVariant(pptx, slideNumbers) {
  return variant({
    platform: 'general',
    codeMode: 'concept',
    status: 'available',
    confidence: 'confirmed',
    source: variantSource(pptx, slideNumbers),
    content: slideNumbers.map((slideNumber) => ({
      type: 'text',
      heading: librarySlideContent[pptx][slideNumber].title,
      text: librarySlideContent[pptx][slideNumber].text,
    })),
  });
}

function missingVariant(platform, codeMode, pptx, slideNumbers = []) {
  return variant({
    platform,
    codeMode,
    status: 'missing',
    confidence: 'confirmed',
    source: variantSource(pptx, slideNumbers),
    content: [],
  });
}

function comingSoonVariant(platform, pptx, slideNumber) {
  return variant({
    platform,
    codeMode: 'concept',
    status: 'coming-soon',
    confidence: 'confirmed',
    source: variantSource(pptx, [slideNumber]),
    content: [],
  });
}

function variant(entry) {
  return entry;
}

function motorSection(id, name, spikeSlides, mindstormsSlides) {
  return section(id, name, standardSelection(), [
    missingVariant('spike', 'blocks', 'Motor.pptx'),
    textVariant('spike', 'Motor.pptx', spikeSlides),
    missingVariant('mindstorms', 'blocks', 'Motor.pptx'),
    textVariant('mindstorms', 'Motor.pptx', mindstormsSlides),
  ]);
}

function repeatSection(id, name, spikeSlides, mindstormsSlides) {
  return section(id, name, standardSelection(), [
    sharedBlockVariant('gentag', 'Gentag.pptx'),
    textVariant('spike', 'Gentag.pptx', spikeSlides),
    textVariant('mindstorms', 'Gentag.pptx', mindstormsSlides),
  ]);
}

function hubSpikeSection(id, name, slides) {
  return section(id, name, singlePlatformSelection('spike'), [
    missingVariant('spike', 'blocks', 'Hub Spike Prime.pptx'),
    textVariant('spike', 'Hub Spike Prime.pptx', slides),
  ]);
}

function comingSoonSection(id, name, slideNumber) {
  return section(
    id,
    name,
    { platforms: ['mindstorms'], codeModes: [], fixedPlatform: 'mindstorms', fixedCodeMode: 'concept' },
    [comingSoonVariant('mindstorms', 'Hub Mindstorm.pptx', slideNumber)],
  );
}

function blockAsset(src, alt, sourcePptx, sourceSlide, sourceMedia) {
  return { src, alt, source: { sourcePptx, sourceSlide, sourceMedia } };
}

function variantSource(pptx, slideNumbers = [], mediaFiles = []) {
  return { pptx, slideNumbers, mediaFiles };
}

function sourcePath(pptx) {
  return `Old Solution (Google Drive)/Differentieret Læring/Bibliotek/${pptx}`;
}
