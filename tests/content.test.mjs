import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  getLibrarySection,
  levels,
  libraryAssets,
  libraryTopics,
  projects,
  resolveLibraryVariant,
} from '../src/content.js';

test('inventory matches the inspected source material', () => {
  assert.equal(levels.length, 4);
  assert.equal(projects.length, 20);
  assert.equal(libraryTopics.length, 11);
});

test('every project belongs to a known level', () => {
  const levelIds = new Set(levels.map((level) => level.id));
  for (const project of projects) assert.ok(levelIds.has(project.levelId), project.name);
});

test('20 complete guides expose 1132 generated steps', () => {
  const ready = projects.filter((project) => project.buildStatus === 'ready');
  assert.equal(ready.length, 20);
  assert.equal(ready.reduce((sum, project) => sum + project.buildSteps.length, 0), 1132);
  for (const project of ready) {
    assert.equal(project.buildSteps[0].number, 1, project.name);
    assert.equal(project.buildSteps.at(-1).number, project.buildSteps.length, project.name);
    assert.ok(project.buildGuideManifest.endsWith('/manifest.json'), project.name);
  }
});

test('source titles do not replace authoritative display names', () => {
  const letSorter = projects.find((project) => project.id === 'farvesorteringsmaskine-let');
  const advancedSorter = projects.find((project) => project.id === 'farvesorteringsmaskine-oevet');
  const largeArm = projects.find((project) => project.id === 'stor-robot-arm');
  assert.deepEqual([letSorter.name, letSorter.legacySource.internalTitle], ['Farvesorteringsmaskine', 'Kortdeler']);
  assert.deepEqual([advancedSorter.name, advancedSorter.legacySource.internalTitle], ['Farvesorteringsmaskine', 'Sorteringsmaskine']);
  assert.deepEqual([largeArm.name, largeArm.legacySource.internalTitle], ['Stor Robot Arm', 'Arm']);
});

test('Guitar keeps its project-specific code source outside build steps', () => {
  const guitar = projects.find((project) => project.id === 'guitar');
  assert.equal(guitar.buildSteps.length, 50);
  assert.equal(guitar.buildSteps.at(-1).sourceSlide, 53);
  assert.deepEqual(guitar.projectSpecificCodeSource, {
    sourcePptx: guitar.legacySource.path,
    slide: 54,
    label: 'Kode Guide',
  });
});

test('Breakdancer has 34 sequential real build steps', () => {
  const project = projects.find((entry) => entry.id === 'breakdancer');
  assert.equal(project.buildStatus, 'ready');
  assert.equal(project.buildSteps.length, 34);
  assert.deepEqual(project.buildSteps.map((step) => step.number), Array.from({ length: 34 }, (_, index) => index + 1));
  assert.deepEqual(project.buildSteps.map((step) => step.sourceSlide), Array.from({ length: 34 }, (_, index) => index + 3));
  assert.deepEqual(
    project.buildSteps.map((step) => step.image.split('/').at(-1)),
    Array.from({ length: 34 }, (_, index) => `${String(index + 1).padStart(3, '0')}.webp`),
  );
});

test('generated Breakdancer manifest matches the content model', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/generated/build-guides/breakdancer/manifest.json', import.meta.url), 'utf8'));
  const project = projects.find((entry) => entry.id === 'breakdancer');
  assert.equal(manifest.id, project.id);
  assert.equal(manifest.level, project.levelId);
  assert.equal(manifest.source.slideCount, project.legacySource.slideCount);
  assert.deepEqual(manifest.buildSteps, project.buildSteps.map((step) => step.image));
  assert.deepEqual(manifest.steps.map((step) => step.sourceSlide), project.buildSteps.map((step) => step.sourceSlide));
});

test('Mecha-bot is available with 89 image-sequence steps', async () => {
  const project = projects.find((entry) => entry.id === 'mecha-bot');
  assert.equal(project.buildStatus, 'ready');
  assert.equal(project.buildSource.type, 'image-sequence');
  assert.equal(project.legacySource.status, 'incomplete');
  assert.equal(project.buildSteps.length, 89);
  assert.deepEqual(
    [project.buildSteps[0].sourceFile, project.buildSteps.at(-1).sourceFile],
    ['1_1x.png', '89_1x.png'],
  );
  await readFile(new URL(`../${project.buildSteps[0].image}`, import.meta.url));
  await readFile(new URL(`../${project.buildSteps.at(-1).image}`, import.meta.url));
});

test('Mecha-bot exposes semantic labels while retaining all 89 viewer pages', () => {
  const project = projects.find((entry) => entry.id === 'mecha-bot');
  assert.equal(project.buildSteps.length, 89);
  assert.deepEqual(
    [project.buildSteps[0].pageType, project.buildSteps[0].pageLabel],
    ['overview', 'Oversigt'],
  );
  assert.deepEqual(
    project.buildSteps.slice(1, 6).map((page) => page.pageLabel),
    Array.from({ length: 5 }, (_, index) => `Materialer · ${index + 1} af 5`),
  );
  assert.deepEqual(
    [project.buildSteps[6].pageType, project.buildSteps[6].instructionNumber, project.buildSteps[6].pageLabel],
    ['build', 1, 'Trin 1 af 82'],
  );
  assert.deepEqual(
    [project.buildSteps[87].pageType, project.buildSteps[87].instructionNumber, project.buildSteps[87].pageLabel],
    ['build', 82, 'Trin 82 af 82'],
  );
  assert.deepEqual(
    [project.buildSteps[88].pageType, project.buildSteps[88].pageLabel],
    ['finished', 'Færdig'],
  );
  assert.equal(project.navigationLabel, 'Vælg side');
});

test('Gaffeltruck keeps 79 steps and uses the new image sequence', async () => {
  const project = projects.find((entry) => entry.id === 'gaffeltruck');
  const manifest = JSON.parse(await readFile(new URL('../assets/generated/build-guides/gaffeltruck/manifest.json', import.meta.url), 'utf8'));
  assert.equal(project.buildSteps.length, 79);
  assert.equal(project.buildSource.type, 'image-sequence');
  assert.equal(project.legacySource.type, 'pptx');
  assert.equal(manifest.source.type, 'image-sequence');
  assert.deepEqual(manifest.steps.map((step) => step.sourceSequence), Array.from({ length: 79 }, (_, index) => index + 1));
  assert.deepEqual(manifest.steps.map((step) => step.sourceFile), Array.from({ length: 79 }, (_, index) => `${index + 1}_1x.png`));
});

test('every library topic contains audited sections and editorial variant metadata', () => {
  for (const topic of libraryTopics) {
    assert.ok(topic.sections.length, topic.name);
    for (const section of topic.sections) {
      assert.ok(section.variants.length, `${topic.name}/${section.name}`);
      for (const variant of section.variants) {
        assert.ok(['spike', 'mindstorms', 'shared', 'general'].includes(variant.platform));
        assert.ok(['blocks', 'text', 'concept'].includes(variant.codeMode));
        assert.ok(['available', 'coming-soon', 'missing'].includes(variant.status));
        assert.ok(['confirmed', 'likely', 'unknown'].includes(variant.confidence));
        assert.ok(variant.source.pptx);
      }
    }
  }
});

test('shared block code resolves for both platforms without duplicated content', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'gentag');
  const section = getLibrarySection(topic, 'gange');
  const spike = resolveLibraryVariant(section, 'spike', 'blocks');
  const mindstorms = resolveLibraryVariant(section, 'mindstorms', 'blocks');
  assert.equal(spike.match, 'shared');
  assert.equal(mindstorms.match, 'shared');
  assert.equal(spike.variant, mindstorms.variant);
  assert.equal(spike.variant.content[0].assetId, 'gentag');
});

test('platform-specific topic uses SPIKE without changing the requested preference', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'hub-spike-prime');
  const section = getLibrarySection(topic, 'matrix-tekst');
  const resolved = resolveLibraryVariant(section, 'mindstorms', 'text');
  assert.deepEqual(section.selection.platforms, ['spike']);
  assert.equal(resolved.platform, 'spike');
  assert.equal(resolved.variant.status, 'available');
});

test('concept-only topic needs neither platform nor code mode', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'mapping');
  const section = getLibrarySection(topic);
  const resolved = resolveLibraryVariant(section, 'mindstorms', 'text');
  assert.deepEqual(section.selection.platforms, []);
  assert.deepEqual(section.selection.codeModes, []);
  assert.equal(resolved.match, 'general');
  assert.equal(resolved.variant.codeMode, 'concept');
});

test('missing variant does not silently resolve to another platform or mode', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'afstandssensor');
  const section = getLibrarySection(topic, 'maal-afstand');
  const resolved = resolveLibraryVariant(section, 'mindstorms', 'blocks');
  assert.equal(resolved.match, 'exact');
  assert.equal(resolved.platform, 'mindstorms');
  assert.equal(resolved.codeMode, 'blocks');
  assert.equal(resolved.variant.status, 'missing');
});

test('coming-soon variant is represented directly from the source', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'hub-mindstorms');
  const resolved = resolveLibraryVariant(getLibrarySection(topic, 'tastatur'), 'spike', 'blocks');
  assert.equal(resolved.platform, 'mindstorms');
  assert.equal(resolved.codeMode, 'concept');
  assert.equal(resolved.variant.status, 'coming-soon');
});

test('all four audited block assets are loadable WebP files', async () => {
  assert.equal(Object.keys(libraryAssets).length, 4);
  for (const asset of Object.values(libraryAssets)) {
    const image = await readFile(new URL(`../${asset.src}`, import.meta.url));
    assert.equal(image.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(image.subarray(8, 12).toString('ascii'), 'WEBP');
  }
});

test('PowerPoint text code keeps line breaks and indentation', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'afstandssensor');
  const resolved = resolveLibraryVariant(getLibrarySection(topic, 'maal-afstand'), 'spike', 'text');
  const example = resolved.variant.content[1].text;
  assert.match(example, /async def main\(\): # main\n    distance =/);
  assert.match(example, /\n\nrunloop\.run\(main\(\)\) # start main $/);
});
