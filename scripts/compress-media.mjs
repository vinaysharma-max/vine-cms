import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const APPLY = process.argv.includes('--apply');
const DELETE_ORIGINALS = process.argv.includes('--delete-originals');
const MAX_WIDTH = 1600;
const QUALITY = 82;
const MIN_SAVING = 0.2;
const SKIP_TYPES = new Set(['image/gif', 'image/svg+xml']);
const WORK_DIR = join(process.cwd(), '.media-migration');
const STATE_FILE = join(WORK_DIR, 'state.json');

if (!process.env.CONVEX_DEPLOY_KEY) {
  console.error('Set CONVEX_DEPLOY_KEY to the production deploy key before running.');
  process.exit(1);
}

function run(fn, args = {}) {
  const output = execFileSync('npx', ['convex', 'run', `mediaMigration:${fn}`, JSON.stringify(args)], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  return JSON.parse(output);
}

const kb = (bytes) => `${(bytes / 1024).toFixed(0)} KB`;
const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

mkdirSync(WORK_DIR, { recursive: true });
const MANIFEST_FILE = join(WORK_DIR, 'manifest.json');
const state = existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : { swapped: [] };
const alreadySwapped = new Set(state.swapped.map((row) => row.mediaId));

if (DELETE_ORIGINALS) {
  const pending = state.swapped.filter((row) => !row.deleted);
  for (let start = 0; start < pending.length; start += 50) {
    const batch = pending.slice(start, start + 50);
    run('deleteStorageFiles', { storageIds: batch.map((row) => row.oldStorageId) });
    for (const row of batch) row.deleted = true;
    writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
  }
  console.log(`Deleted originals: ${pending.length}`);
  process.exit(0);
}

const media = run('listMedia');
console.log(`Media records: ${media.length}`);

const manifest = APPLY && existsSync(MANIFEST_FILE) ? JSON.parse(readFileSync(MANIFEST_FILE, 'utf8')) : null;
const candidates = manifest ? manifest.filter((row) => !alreadySwapped.has(row.mediaId) && existsSync(row.file)) : [];
let before = 0;
let after = 0;
for (const record of manifest ? [] : media) {
  if (alreadySwapped.has(record.mediaId) || !record.url || SKIP_TYPES.has(record.contentType)) continue;
  const response = await fetch(record.url);
  if (!response.ok) {
    console.warn(`skip ${record.mediaId}: download ${response.status}`);
    continue;
  }
  const input = Buffer.from(await response.arrayBuffer());
  const meta = await sharp(input).metadata();
  const output = await sharp(input)
    .resize({ width: Math.min(MAX_WIDTH, meta.width ?? MAX_WIDTH), withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  if (output.length > input.length * (1 - MIN_SAVING)) continue;
  const file = join(WORK_DIR, `${record.mediaId}.webp`);
  writeFileSync(file, output);
  before += input.length;
  after += output.length;
  candidates.push({ ...record, file, newSize: output.length });
  console.log(`${record.mediaId} ${meta.width}x${meta.height} ${kb(input.length)} -> ${kb(output.length)}`);
}

if (manifest) console.log(`\nUsing ${candidates.length} compressed files from the dry run`);
else {
  writeFileSync(MANIFEST_FILE, JSON.stringify(candidates, null, 2));
  console.log(`\nTo compress: ${candidates.length} images, ${mb(before)} -> ${mb(after)}`);
}
if (!APPLY) {
  console.log('Dry run only. Re-run with --apply to upload and relink; --delete-originals removes the old files afterwards.');
  process.exit(0);
}

const uploadUrls = run('generateUploadUrls', { count: candidates.length });
const swaps = [];
for (const [index, candidate] of candidates.entries()) {
  const upload = await fetch(uploadUrls[index], {
    method: 'POST',
    headers: { 'Content-Type': 'image/webp' },
    body: readFileSync(candidate.file),
  });
  if (!upload.ok) {
    console.warn(`skip ${candidate.mediaId}: upload ${upload.status}`);
    continue;
  }
  const { storageId } = await upload.json();
  swaps.push({
    mediaId: candidate.mediaId,
    oldStorageId: candidate.storageId,
    newStorageId: storageId,
    size: candidate.newSize,
    contentType: 'image/webp',
    filename: candidate.filename.replace(/\.[^.]+$/, '') + '.webp',
  });
}

for (let start = 0; start < swaps.length; start += 25) {
  const swapped = run('swapMediaFiles', { swaps: swaps.slice(start, start + 25) });
  state.swapped.push(...swapped);
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
console.log(`Relinked media: ${state.swapped.length}`);

const urls = state.swapped.map((row) => [row.oldUrl, row.newUrl]);
for (const table of ['postBodies', 'editorDrafts']) {
  let cursor = null;
  let changed = 0;
  do {
    const page = run('rewriteContentUrls', { table, urls, cursor, dryRun: false });
    changed += page.changed;
    cursor = page.cursor;
  } while (cursor);
  console.log(`Rewrote ${table}: ${changed}`);
}
console.log('Originals are kept. Check the blog, then run with --delete-originals.');
