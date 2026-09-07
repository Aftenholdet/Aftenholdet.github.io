import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const output = path.join(root, 'dist');
const entries = ['index.html', '.nojekyll', 'src', 'assets'];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const entry of entries) {
  await cp(path.join(root, entry), path.join(output, entry), { recursive: true });
}

for (const forbiddenDirectory of ['source-assets', 'Old Solution (Google Drive)']) {
  try {
    await access(path.join(output, forbiddenDirectory));
    throw new Error(`Build-output indeholder den forbudte kildemappe ${forbiddenDirectory}.`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}

const outputFiles = await findFiles(output);
const pptxFiles = outputFiles.filter((file) => path.extname(file).toLowerCase() === '.pptx');
if (pptxFiles.length) throw new Error(`Build-output indeholder PPTX-filer: ${pptxFiles.join(', ')}`);

console.log(`Statisk site bygget i ${output}`);

async function findFiles(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findFiles(entryPath));
    else if (entry.isFile()) found.push(entryPath);
  }
  return found;
}
