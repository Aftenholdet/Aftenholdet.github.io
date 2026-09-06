import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  codeModeOptions,
  levels,
  libraryTopics,
  platformOptions,
  projects,
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
  assert.equal(manifest.source.slideCount, project.source.slideCount);
  assert.deepEqual(manifest.buildSteps, project.buildSteps.map((step) => step.image));
  assert.deepEqual(manifest.steps.map((step) => step.sourceSlide), project.buildSteps.map((step) => step.sourceSlide));
});

test('every library topic explicitly models all four combinations', () => {
  for (const topic of libraryTopics) {
    for (const platform of platformOptions) {
      for (const mode of codeModeOptions) {
        assert.ok(topic.variants[platform.id][mode.id].status, `${topic.name}: ${platform.id}/${mode.id}`);
      }
    }
  }
});

test('Afstandssensor has converted text examples for both platforms only', () => {
  const topic = libraryTopics.find((entry) => entry.id === 'afstandssensor');
  assert.equal(topic.variants.spike.text.status, 'available');
  assert.equal(topic.variants.mindstorms.text.status, 'available');
  assert.equal(topic.variants.spike.blocks.status, 'missing');
  assert.equal(topic.variants.mindstorms.blocks.status, 'missing');
});
