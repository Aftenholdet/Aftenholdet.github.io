const projectAsset = (id, file = 'thumbnail.png') => `assets/projects/${id}/${file}`;
const buildGuideAsset = (id, file) => `assets/generated/build-guides/${id}/${file}`;

const breakdancerSteps = Array.from({ length: 34 }, (_, index) => ({
  number: index + 1,
  image: buildGuideAsset('breakdancer', `${String(index + 1).padStart(3, '0')}.webp`),
  alt: `Breakdancer, byggetrin ${index + 1} af 34`,
  sourceSlide: index + 3,
}));

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
    buildStatus: 'ready',
    buildSteps: breakdancerSteps,
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
  project('mecha-bot', 'Mecha-bot', 'oevet', 2, '3. Øvet/Mecha-bot.pptx', {
    buildStatus: 'needs-review',
    issues: ['Kilden indeholder kun to slides og kan være ufuldstændig.'],
  }),
  project('rul-bot', 'Rul-Bot', 'oevet', 50, '3. Øvet/Rul-Bot.pptx'),

  project('stor-robot-arm', 'Stor Robot Arm', 'avanceret', 177, '4. Avanceret/Stor Robot Arm.pptx', {
    issues: ['Præsentationens interne titel er "Arm".'],
  }),
];

function project(id, name, levelId, sourceSlideCount, sourcePath, options = {}) {
  return {
    id,
    name,
    levelId,
    thumbnail: projectAsset(id),
    source: {
      type: 'pptx',
      path: `Old Solution (Google Drive)/Differentieret Læring/${sourcePath}`,
      slideCount: sourceSlideCount,
    },
    buildStatus: options.buildStatus ?? 'source-only',
    buildSteps: options.buildSteps ?? [],
    note: options.note ?? '',
    issues: options.issues ?? [],
  };
}

export const libraryCategories = [
  { id: 'sensorer', name: 'Sensorer' },
  { id: 'motor', name: 'Motor og bevægelse' },
  { id: 'programlogik', name: 'Programlogik' },
  { id: 'hub', name: 'Hub og styring' },
];

const missing = (message = 'Denne variation blev ikke fundet i kildematerialet.') => ({
  status: 'missing',
  message,
});

const sourceOnly = (slides, message = 'Variationen findes i PowerPoint-kilden, men er endnu ikke overført til webguiden.') => ({
  status: 'source-only',
  sourceSlides: slides,
  message,
});

const unclear = (slides, message) => ({ status: 'unclear', sourceSlides: slides, message });

const comingSoon = (message = 'Kildematerialet markerer denne kode som "Kode kommer snart".') => ({
  status: 'coming-soon',
  message,
});

const available = (slides, sections) => ({ status: 'available', sourceSlides: slides, sections });

const variants = ({ spikeBlocks, spikeText, mindstormsBlocks, mindstormsText }) => ({
  spike: {
    blocks: spikeBlocks ?? missing(),
    text: spikeText ?? missing(),
  },
  mindstorms: {
    blocks: mindstormsBlocks ?? missing(),
    text: mindstormsText ?? missing(),
  },
});

export const libraryTopics = [
  {
    id: 'afstandssensor',
    name: 'Afstandssensor',
    categoryId: 'sensorer',
    description: 'Mål afstand og styr sensorens fire lys.',
    source: librarySource('Afstandssensor.pptx', 12),
    variants: variants({
      spikeText: available([4, 5, 9, 10], [
        {
          title: 'Mål afstand',
          body: 'Sensoren på port A måler afstanden i millimeter. Eksemplet skriver målingen i konsollen.',
          code: `from hub import port\nimport runloop\nimport distance_sensor\n\nasync def main():\n    afstand = distance_sensor.distance(port.A)\n    print(afstand)\n\nrunloop.run(main())`,
        },
        {
          title: 'Tænd sensorens lys',
          body: 'Hver af afstandssensorens fire pixels kan styres med koordinater og en lysstyrke fra 0 til 100.',
          code: `from hub import port\nimport runloop\nimport distance_sensor\n\nasync def main():\n    distance_sensor.set_pixel(port.A, 1, 0, 100)\n    distance_sensor.set_pixel(port.A, 0, 0, 100)\n    distance_sensor.set_pixel(port.A, 1, 1, 100)\n    distance_sensor.set_pixel(port.A, 0, 1, 100)\n\nrunloop.run(main())`,
        },
      ]),
      mindstormsText: available([6, 7, 11, 12], [
        {
          title: 'Mål afstand',
          body: 'Opret sensoren på port A, mål i centimeter og skriv resultatet i konsollen.',
          code: `from mindstorms import DistanceSensor\n\nafstand = DistanceSensor('A').get_distance_cm()\nprint("cm:", afstand)`,
        },
        {
          title: 'Tænd sensorens lys',
          body: 'Alle fire lys sættes her til 100 procent lysstyrke.',
          code: `from mindstorms import DistanceSensor\n\nDistanceSensor('A').light_up(100, 100, 100, 100)\nprint("Alle LEDer på afstandsmåleren er tændt!")`,
        },
      ]),
    }),
  },
  {
    id: 'farvesensor',
    name: 'Farvesensor',
    categoryId: 'sensorer',
    description: 'Læs den farve, sensoren ser.',
    source: librarySource('Farvesensor.pptx', 7),
    variants: variants({
      spikeText: sourceOnly([4, 5]),
      mindstormsText: sourceOnly([6, 7]),
    }),
  },
  {
    id: 'kraftsensor',
    name: 'Kraftsensor',
    categoryId: 'sensorer',
    description: 'Registrér tryk og hvor hårdt sensoren trykkes.',
    source: librarySource('Kraftsensor.pptx', 12),
    variants: variants({
      spikeText: sourceOnly([4, 5, 9, 10]),
      mindstormsText: sourceOnly([6, 7, 11, 12]),
    }),
  },
  {
    id: 'motor',
    name: 'Motor',
    categoryId: 'motor',
    description: 'Kør en motor med hastighed, grader eller position.',
    source: librarySource('Motor.pptx', 17),
    variants: variants({
      spikeText: available([4, 5, 8, 9, 12, 13, 16], [
        {
          title: 'Kør motoren',
          body: 'Start motoren på port A. SPIKE bruger hastigheder fra -1000 til 1000.',
          code: `from hub import port\nimport runloop\nimport motor\n\nasync def main():\n    motor.run(port.A, 1000)\n\nrunloop.run(main())`,
        },
        {
          title: 'Kør et bestemt antal grader',
          body: 'Vent på, at motoren har drejet 180 grader.',
          code: `from hub import port\nimport runloop\nimport motor\n\nasync def main():\n    await motor.run_for_degrees(port.A, 180, 1000)\n\nrunloop.run(main())`,
        },
        {
          title: 'Kør til en position',
          body: 'Kør motoren med uret til den absolutte position 180 grader.',
          code: `await motor.run_to_absolute_position(\n    port.A, 180, 1000, direction=motor.CLOCKWISE\n)`,
        },
      ]),
      mindstormsText: available([6, 10, 14], [
        {
          title: 'Kør motoren',
          body: 'Opret en motor på port A og start den ved 100 procent hastighed.',
          code: `from mindstorms import Motor\n\nmotorA = Motor('A')\nmotorA.start(100)`,
        },
        {
          title: 'Kør et bestemt antal grader',
          body: 'Kør motoren 180 grader ved 100 procent hastighed.',
          code: `from mindstorms import Motor\n\nmotorA = Motor('A')\nmotorA.run_for_degrees(180, 100)`,
        },
        {
          title: 'Kør til en position',
          body: 'Kør motoren med uret til position 180 grader.',
          code: `from mindstorms import Motor\n\nmotorA = Motor('A')\nmotorA.run_to_position(180, 'clockwise', 100)`,
        },
        {
          title: 'To motorer samtidig',
          body: 'Slide 17 indeholder kun en overskrift og et billede. Tekstkoden kunne ikke aflæses sikkert.',
        },
      ]),
    }),
  },
  {
    id: 'vent',
    name: 'Vent',
    categoryId: 'programlogik',
    description: 'Vent et bestemt tidsrum eller indtil noget sker.',
    source: librarySource('Vent.pptx', 7),
    variants: variants({
      spikeText: sourceOnly([4, 5]),
      mindstormsText: sourceOnly([6, 7]),
    }),
  },
  {
    id: 'gentag',
    name: 'Gentag',
    categoryId: 'programlogik',
    description: 'Gentag kode et antal gange, indtil noget sker eller for evigt.',
    source: librarySource('Gentag.pptx', 11),
    variants: variants({
      spikeText: sourceOnly([4, 7, 10]),
      mindstormsText: unclear([5, 8, 11], 'Der findes generelle Python-eksempler, men de er ikke tydeligt mærket som MINDSTORMS.'),
    }),
  },
  {
    id: 'hvis-ellers',
    name: 'Hvis ... Ellers',
    categoryId: 'programlogik',
    description: 'Lad programmet vælge mellem forskellige handlinger.',
    source: librarySource('Hvis ... Ellers.pptx', 8),
    variants: variants({
      spikeText: sourceOnly([4, 7]),
      mindstormsText: unclear([5, 8], 'Der findes generelle Python-eksempler, men de er ikke tydeligt mærket som MINDSTORMS.'),
    }),
  },
  {
    id: 'mapping',
    name: 'Mapping',
    categoryId: 'programlogik',
    description: 'Forstå hvordan én talværdi kan omregnes til et andet interval.',
    source: librarySource('Mapping.pptx', 4),
    generalContent: 'Kilden er en konceptuel forklaring og er ikke opdelt i platform og kodetype.',
    variants: variants({}),
  },
  {
    id: 'asynkrone-traade',
    name: 'Asynkrone Tråde',
    categoryId: 'programlogik',
    description: 'Kør flere uafhængige processer i samme program.',
    source: librarySource('Asynkrone Tråde.pptx', 4),
    variants: variants({
      spikeText: sourceOnly([4]),
    }),
  },
  {
    id: 'hub-spike-prime',
    name: 'Hub SPIKE Prime',
    categoryId: 'hub',
    description: 'Brug lysmatrix, knaplys og højttaler på SPIKE-hubben.',
    source: librarySource('Hub Spike Prime.pptx', 12),
    variants: variants({
      spikeText: sourceOnly([4, 6, 8, 10, 12]),
    }),
  },
  {
    id: 'hub-mindstorms',
    name: 'Hub Mindstorms',
    categoryId: 'hub',
    description: 'Materiale til LEGO Inventor Hub, fjernstyring og controllere.',
    source: librarySource('Hub Mindstorm.pptx', 11),
    variants: variants({
      mindstormsText: comingSoon(),
    }),
  },
];

function librarySource(file, slideCount) {
  return {
    type: 'pptx',
    path: `Old Solution (Google Drive)/Differentieret Læring/Bibliotek/${file}`,
    slideCount,
  };
}

export const platformOptions = [
  { id: 'spike', label: 'SPIKE' },
  { id: 'mindstorms', label: 'MINDSTORMS' },
];

export const codeModeOptions = [
  { id: 'blocks', label: 'Blokke' },
  { id: 'text', label: 'Tekst' },
];

export function getLevel(id) {
  return levels.find((level) => level.id === id);
}

export function getProject(id) {
  return projects.find((projectEntry) => projectEntry.id === id);
}

export function getProjectsForLevel(levelId) {
  return projects.filter((projectEntry) => projectEntry.levelId === levelId);
}

export function getLibraryTopic(id) {
  return libraryTopics.find((topic) => topic.id === id);
}
