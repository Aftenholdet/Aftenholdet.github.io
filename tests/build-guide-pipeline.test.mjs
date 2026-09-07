import test from 'node:test';
import assert from 'node:assert/strict';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { unzipSync } from 'fflate';
import sharp from 'sharp';
import {
  analyzeImageSequence,
  analyzePresentation,
  analyzeSlide,
  computeBuildKey,
  outputIsCurrent,
  replaceDirectoryAtomically,
  resolvePageMetadata,
  sortImageSequenceEntries,
  validatePageSemantics,
  validateExtractableSlide,
} from '../scripts/convert-build-guides.mjs';

const normalProject = { id: 'fixture', strategy: 'extract-single-slide-image' };
const backgroundProject = {
  id: 'fixture-background',
  strategy: 'extract-single-slide-image',
  backgroundImageSlides: [1],
};

test('declarative page semantics resolve independently of a project id', () => {
  const project = {
    id: 'semantic-fixture',
    pageSemantics: [
      { type: 'overview', pageStart: 1, pageEnd: 1 },
      { type: 'materials', pageStart: 2, pageEnd: 3 },
      { type: 'build', pageStart: 4, pageEnd: 5 },
      { type: 'finished', pageStart: 6, pageEnd: 6 },
    ],
  };
  validatePageSemantics(project, 6);
  assert.equal(resolvePageMetadata(project, 1, 6).pageLabel, 'Oversigt');
  assert.equal(resolvePageMetadata(project, 3, 6).pageLabel, 'Materialer · 2 af 2');
  assert.deepEqual(
    [resolvePageMetadata(project, 4, 6).instructionNumber, resolvePageMetadata(project, 5, 6).pageLabel],
    [1, 'Trin 2 af 2'],
  );
  assert.equal(resolvePageMetadata(project, 6, 6).pageLabel, 'Færdig');
});

test('declarative page semantics reject overlaps and uncovered pages', () => {
  assert.throws(
    () => validatePageSemantics({ id: 'overlap', pageSemantics: [
      { type: 'overview', pageStart: 1, pageEnd: 2 },
      { type: 'build', pageStart: 2, pageEnd: 3 },
    ] }, 3),
    /flere semantiske typer/,
  );
  assert.throws(
    () => validatePageSemantics({ id: 'gap', pageSemantics: [
      { type: 'overview', pageStart: 1, pageEnd: 1 },
      { type: 'build', pageStart: 3, pageEnd: 3 },
    ] }, 3),
    /Sider uden semantisk type: 2/,
  );
});

test('normal single-picture build slide is accepted', () => {
  const slide = analyzeSlide(fixtureArchive({ body: picture('rId1') }), 'ppt/slides/slide1.xml', 1);
  const source = validateExtractableSlide(normalProject, slide);
  assert.equal(source.representation, 'picture');
  assert.equal(source.path, 'ppt/media/image1.png');
});

test('declared single-background build slide is accepted', () => {
  const slide = analyzeSlide(fixtureArchive({ background: 'rId1' }), 'ppt/slides/slide1.xml', 1);
  const source = validateExtractableSlide(backgroundProject, slide);
  assert.equal(source.representation, 'slide-background');
  assert.equal(slide.pictureCount, 0);
  assert.equal(slide.backgroundImageCount, 1);
});

test('background with separate text is rejected', () => {
  const slide = analyzeSlide(fixtureArchive({
    background: 'rId1',
    body: '<p:sp><p:txBody><a:p><a:r><a:t>Separat instruktion</a:t></a:r></a:p></p:txBody></p:sp>',
  }), 'ppt/slides/slide1.xml', 1);
  assert.throws(() => validateExtractableSlide(backgroundProject, slide), /tekstlaget|formobjekter/);
});

test('background with an extra image is rejected', () => {
  const slide = analyzeSlide(fixtureArchive({
    background: 'rId1',
    body: picture('rId2'),
    relationships: [['rId1', '../media/image1.png'], ['rId2', '../media/image2.png']],
    media: ['ppt/media/image1.png', 'ppt/media/image2.png'],
  }), 'ppt/slides/slide1.xml', 1);
  assert.throws(() => validateExtractableSlide(backgroundProject, slide), /ekstra billeder/);
});

test('background with a separate shape is rejected', () => {
  const slide = analyzeSlide(fixtureArchive({
    background: 'rId1',
    body: '<p:sp><p:spPr><a:solidFill><a:srgbClr val="FF0000"/></a:solidFill></p:spPr></p:sp>',
  }), 'ppt/slides/slide1.xml', 1);
  assert.throws(() => validateExtractableSlide(backgroundProject, slide), /formobjekter/);
});

test('missing image relationship is rejected', () => {
  const archive = fixtureArchive({ body: picture('rIdMissing'), relationships: [] });
  assert.throws(
    () => analyzeSlide(archive, 'ppt/slides/slide1.xml', 1),
    /billedrelationen rIdMissing blev ikke fundet/,
  );
});

test('Breakdancer regression remains 34 ordered single-picture steps', async () => {
  const root = new URL('../', import.meta.url);
  const config = JSON.parse(await readFile(new URL('content/build-guides.config.json', root), 'utf8'));
  const project = config.projects.find((entry) => entry.id === 'breakdancer');
  const source = await readFile(new URL(project.source.replaceAll(' ', '%20'), root));
  const presentation = analyzePresentation(unzipSync(new Uint8Array(source)));

  assert.equal(presentation.slides.length, 36);
  assert.equal(project.includeSlides.length, 34);
  assert.deepEqual(project.includeSlides, Array.from({ length: 34 }, (_, index) => index + 3));
  for (const slideNumber of project.includeSlides) {
    const sourceImage = validateExtractableSlide(project, presentation.slides[slideNumber - 1]);
    assert.equal(sourceImage.representation, 'picture');
  }
});

test('image sequences are sorted numerically rather than by filesystem order', () => {
  const sorted = sortImageSequenceEntries([
    { sequence: 12, fileName: '12.png' },
    { sequence: 3, fileName: '3.png' },
    { sequence: 7, fileName: '7.png' },
  ]);
  assert.deepEqual(sorted.map((entry) => entry.sequence), [3, 7, 12]);
});

test('image sequence 1, 2, 10 is ordered as 1, 2, 10', () => {
  const sorted = sortImageSequenceEntries([
    { sequence: 1, fileName: '1.png' },
    { sequence: 10, fileName: '10.png' },
    { sequence: 2, fileName: '2.png' },
  ]);
  assert.deepEqual(sorted.map((entry) => entry.fileName), ['1.png', '2.png', '10.png']);
});

test('duplicate image sequence numbers are rejected', async () => {
  await withSequenceFixture(['1.png', '01.png'], async (directory) => {
    await assert.rejects(
      analyzeImageSequence(directory, sequenceProject({ expectedImageCount: 2, expectedSequenceEnd: 1 })),
      /Dublerede sekvensnumre: 1/,
    );
  });
});

test('missing image sequence numbers are rejected', async () => {
  await withSequenceFixture(['1.png', '3.png'], async (directory) => {
    await assert.rejects(
      analyzeImageSequence(directory, sequenceProject({ expectedImageCount: 2, expectedSequenceEnd: 3 })),
      /Manglende sekvensnumre: 2/,
    );
  });
});

test('unknown files in an image sequence are rejected explicitly', async () => {
  await withSequenceFixture(['1.png'], async (directory) => {
    await writeFile(path.join(directory, 'notes.txt'), 'not an image');
    await assert.rejects(
      analyzeImageSequence(directory, sequenceProject()),
      /Ukendte filer eller mapper.*notes\.txt/,
    );
  });
});

test('missing image sequence source is rejected', async () => {
  const missing = path.join(os.tmpdir(), `missing-build-sequence-${process.pid}-${Date.now()}`);
  await assert.rejects(analyzeImageSequence(missing, sequenceProject()), /kan ikke læses/);
});

test('image sequence content hash affects the build key', () => {
  const input = {
    sourceType: 'image-sequence',
    project: sequenceProject(),
    settings: { quality: 90 },
  };
  assert.notEqual(
    computeBuildKey({ ...input, sourceSha256: 'source-a' }),
    computeBuildKey({ ...input, sourceSha256: 'source-b' }),
  );
});

test('unchanged image sequence output is recognized as current', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-guide-current-'));
  try {
    const output = path.join(directory, 'guide');
    await mkdir(output);
    await writeFile(path.join(directory, '001.webp'), 'webp');
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
      buildKey: 'same-key',
      steps: [{ path: '001.webp', bytes: 4 }],
    }));
    assert.equal(await outputIsCurrent(output, 'same-key', 1, directory), true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('changed image sequence build key invalidates current output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-guide-stale-'));
  try {
    const sourceDirectory = path.join(directory, 'source');
    const output = path.join(directory, 'guide');
    await mkdir(sourceDirectory);
    await mkdir(output);
    await sharp({ create: { width: 4, height: 3, channels: 3, background: 'red' } })
      .png().toFile(path.join(sourceDirectory, '1.png'));
    const project = sequenceProject();
    const before = await analyzeImageSequence(sourceDirectory, project);
    const oldKey = computeBuildKey({
      sourceType: 'image-sequence', sourceSha256: before.sha256, project, settings: { quality: 90 },
    });
    await writeFile(path.join(directory, '001.webp'), 'webp');
    await writeFile(path.join(output, 'manifest.json'), JSON.stringify({
      buildKey: oldKey,
      steps: [{ path: '001.webp', bytes: 4 }],
    }));
    await sharp({ create: { width: 4, height: 3, channels: 3, background: 'blue' } })
      .png().toFile(path.join(sourceDirectory, '1.png'));
    const after = await analyzeImageSequence(sourceDirectory, project);
    const newKey = computeBuildKey({
      sourceType: 'image-sequence', sourceSha256: after.sha256, project, settings: { quality: 90 },
    });
    assert.notEqual(newKey, oldKey);
    assert.equal(await outputIsCurrent(output, newKey, 1, directory), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test('atomic output replacement leaves only the new directory', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-guide-atomic-'));
  try {
    const temporary = path.join(directory, 'temporary');
    const output = path.join(directory, 'output');
    const backup = path.join(directory, 'backup');
    await mkdir(temporary);
    await mkdir(output);
    await writeFile(path.join(temporary, 'new.txt'), 'new');
    await writeFile(path.join(output, 'old.txt'), 'old');
    await replaceDirectoryAtomically(temporary, output, backup);
    await access(path.join(output, 'new.txt'));
    await assert.rejects(access(path.join(output, 'old.txt')), /ENOENT/);
    await assert.rejects(access(temporary), /ENOENT/);
    await assert.rejects(access(backup), /ENOENT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function sequenceProject(overrides = {}) {
  return {
    id: 'sequence-fixture',
    sourceType: 'image-sequence',
    ordering: 'numeric-filename',
    sequencePattern: '^(\\d+)\\.png$',
    expectedImageCount: 1,
    expectedSequenceStart: 1,
    expectedSequenceEnd: 1,
    ...overrides,
  };
}

async function withSequenceFixture(fileNames, callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'build-guide-sequence-'));
  try {
    for (const [index, fileName] of fileNames.entries()) {
      await sharp({
        create: { width: 4, height: 3, channels: 3, background: { r: index * 20, g: 0, b: 0 } },
      }).png().toFile(path.join(directory, fileName));
    }
    await callback(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function fixtureArchive(options = {}) {
  const relationships = options.relationships ?? [['rId1', '../media/image1.png']];
  const media = options.media ?? ['ppt/media/image1.png'];
  const background = options.background
    ? `<p:bg><p:bgPr><a:blipFill><a:blip r:embed="${options.background}"/></a:blipFill></p:bgPr></p:bg>`
    : '';
  const slide = `<?xml version="1.0" encoding="UTF-8"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
      xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <p:cSld>${background}<p:spTree>${options.body || ''}</p:spTree></p:cSld>
    </p:sld>`;
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      ${relationships.map(([id, target]) => `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="${target}"/>`).join('')}
    </Relationships>`;
  return {
    'ppt/slides/slide1.xml': encode(slide),
    'ppt/slides/_rels/slide1.xml.rels': encode(rels),
    ...Object.fromEntries(media.map((name) => [name, new Uint8Array([1, 2, 3])])),
  };
}

function picture(relationshipId) {
  return `<p:pic><p:nvPicPr><p:cNvPr id="1" name="Build"/></p:nvPicPr><p:blipFill><a:blip r:embed="${relationshipId}"/></p:blipFill></p:pic>`;
}

function encode(value) {
  return new TextEncoder().encode(value);
}
