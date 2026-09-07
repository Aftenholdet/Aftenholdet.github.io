import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { strFromU8, unzipSync } from 'fflate';
import { XMLParser } from 'fast-xml-parser';
import sharp from 'sharp';

const root = process.cwd();
const config = JSON.parse(await readFile(path.join(root, 'content', 'library-source-map.json'), 'utf8'));
const sourceRoot = path.join(root, config.sourceRoot);
const generatedCodePath = path.join(root, config.generatedCode);
const assetsOutput = path.join(root, config.assetsOutput);
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  trimValues: false,
  isArray: (name) => ['Relationship', 'p:sldId', 'p:sp', 'a:p', 'a:r', 'a:fld'].includes(name),
});

const archives = new Map();
const generatedSlides = {};

for (const entry of config.textSlides) {
  const archive = await getArchive(entry.pptx);
  const slidePaths = presentationSlidePaths(archive);
  generatedSlides[entry.pptx] = {};
  for (const slideNumber of entry.slides) {
    const slidePath = slidePaths[slideNumber - 1];
    if (!slidePath) throw new Error(`${entry.pptx}: slide ${slideNumber} findes ikke.`);
    const shapes = textShapes(parseEntry(archive, slidePath));
    if (shapes.length !== 2) {
      throw new Error(`${entry.pptx}: slide ${slideNumber} har ${shapes.length} tekst-shapes; forventede titel og indhold.`);
    }
    generatedSlides[entry.pptx][slideNumber] = {
      title: shapes[0],
      text: shapes[1],
    };
  }
}

await mkdir(path.dirname(generatedCodePath), { recursive: true });
await writeFile(
  generatedCodePath,
  `// Generated from audited PowerPoint text layers. Do not edit by hand.\nexport const librarySlideContent = ${JSON.stringify(generatedSlides, null, 2)};\n`,
  'utf8',
);

const manifest = { schemaVersion: 1, generatedAt: new Date().toISOString(), assets: [] };
await mkdir(path.join(assetsOutput, 'blocks'), { recursive: true });

for (const asset of config.blockAssets) {
  const archive = await getArchive(asset.pptx);
  const slidePaths = presentationSlidePaths(archive);
  const slidePath = slidePaths[asset.sourceSlide - 1];
  const relatedMedia = imageTargetsForSlide(archive, slidePath);
  if (!relatedMedia.includes(asset.sourceMedia)) {
    throw new Error(`${asset.pptx}: slide ${asset.sourceSlide} refererer ikke til ${asset.sourceMedia}.`);
  }
  const sourceBytes = archive[asset.sourceMedia];
  if (!sourceBytes) throw new Error(`${asset.pptx}: mangler ${asset.sourceMedia}.`);
  const outputPath = path.join(assetsOutput, asset.output);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await sharp(Buffer.from(sourceBytes), { limitInputPixels: 40_000_000 })
    .resize({ width: 1200, height: 1200, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 90, alphaQuality: 100, effort: 6, nearLossless: true })
    .toFile(outputPath);
  const outputBytes = await readFile(outputPath);
  const metadata = await sharp(outputBytes).metadata();
  manifest.assets.push({
    id: asset.id,
    sourcePptx: asset.pptx,
    sourceSlide: asset.sourceSlide,
    sourceMedia: asset.sourceMedia,
    sourceSha256: sha256(sourceBytes),
    output: path.posix.join(config.assetsOutput, asset.output),
    outputSha256: sha256(outputBytes),
    width: metadata.width,
    height: metadata.height,
    bytes: outputBytes.length,
  });
}

await writeFile(path.join(assetsOutput, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`Genererede ${Object.values(generatedSlides).reduce((sum, slides) => sum + Object.keys(slides).length, 0)} tekstslides og ${manifest.assets.length} blok-assets.`);

async function getArchive(filename) {
  if (!archives.has(filename)) {
    const bytes = await readFile(path.join(sourceRoot, filename));
    archives.set(filename, unzipSync(new Uint8Array(bytes)));
  }
  return archives.get(filename);
}

function presentationSlidePaths(archive) {
  const presentation = parseEntry(archive, 'ppt/presentation.xml');
  const relationships = relationshipMap(parseEntry(archive, 'ppt/_rels/presentation.xml.rels'));
  return presentation['p:presentation']['p:sldIdLst']['p:sldId'].map((slide) => {
    const relationship = relationships.get(slide['@_r:id']);
    if (!relationship || !String(relationship['@_Type']).endsWith('/slide')) throw new Error('Ugyldig slide-relation.');
    return normalizeTarget('ppt/presentation.xml', relationship['@_Target']);
  });
}

function imageTargetsForSlide(archive, slidePath) {
  const relsPath = path.posix.join(path.posix.dirname(slidePath), '_rels', `${path.posix.basename(slidePath)}.rels`);
  return [...relationshipMap(parseEntry(archive, relsPath)).values()]
    .filter((relationship) => String(relationship['@_Type']).endsWith('/image'))
    .map((relationship) => normalizeTarget(slidePath, relationship['@_Target']));
}

function textShapes(document) {
  const shapes = document['p:sld']?.['p:cSld']?.['p:spTree']?.['p:sp'] || [];
  return shapes.map((shape) => {
    const paragraphs = shape['p:txBody']?.['a:p'] || [];
    return paragraphs.map(paragraphText).join('\n').replace(/\n+$/g, '');
  }).filter((text) => text.trim());
}

function paragraphText(paragraph) {
  const runs = [...(paragraph['a:r'] || []), ...(paragraph['a:fld'] || [])];
  if (!runs.length && paragraph['a:endParaRPr']) return '';
  return runs.map((run) => textValue(run['a:t'])).join('');
}

function textValue(value) {
  if (value == null) return '';
  return typeof value === 'object' ? String(value['#text'] || '') : String(value);
}

function relationshipMap(document) {
  return new Map((document.Relationships?.Relationship || []).map((relationship) => [relationship['@_Id'], relationship]));
}

function normalizeTarget(ownerPath, target) {
  if (target.startsWith('/')) return target.slice(1);
  return path.posix.normalize(path.posix.join(path.posix.dirname(ownerPath), target));
}

function parseEntry(archive, entryPath) {
  const entry = archive[entryPath];
  if (!entry) throw new Error(`PPTX mangler ${entryPath}.`);
  return parser.parse(strFromU8(entry));
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
