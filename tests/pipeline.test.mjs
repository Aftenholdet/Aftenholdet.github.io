import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(root, 'assets', 'generated', 'build-guides', 'breakdancer');

test('generated build-guide images are bounded WebP files', async () => {
  const manifest = JSON.parse(await readFile(path.join(outputDir, 'manifest.json'), 'utf8'));
  assert.equal(manifest.steps.length, 34);
  assert.equal(manifest.output.imageCount, 34);

  for (const [index, step] of manifest.steps.entries()) {
    assert.equal(path.basename(step.path), `${String(index + 1).padStart(3, '0')}.webp`);
    assert.ok(step.width <= manifest.conversion.maxWidth);
    assert.ok(step.height <= manifest.conversion.maxHeight);
    assert.ok(step.bytes > 0);
    const image = await readFile(path.join(root, step.path));
    assert.equal(image.subarray(0, 4).toString('ascii'), 'RIFF');
    assert.equal(image.subarray(8, 12).toString('ascii'), 'WEBP');
  }
});

test('unchanged source and settings do not rewrite generated output', async () => {
  const firstImage = path.join(outputDir, '001.webp');
  const before = await stat(firstImage);
  const { stdout } = await execFileAsync(process.execPath, [
    path.join(root, 'scripts', 'convert-build-guides.mjs'),
    '--project',
    'breakdancer',
  ], { cwd: root });
  const after = await stat(firstImage);

  assert.match(stdout, /\[SKIP\].*up-to-date/);
  assert.equal(after.mtimeMs, before.mtimeMs);
});

