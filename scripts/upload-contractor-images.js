#!/usr/bin/env node
/**
 * Compresses and uploads the already-downloaded contractor hero photos
 * (images/contractors/, fetched by scripts/batch-fetch-places.js) to the
 * public Supabase Storage bucket `contractor-images` — no images live in
 * the git repo/static site; everything is served from Supabase. Rewrites
 * content/data/contractor-images.json to point at the Supabase public URL
 * instead of a local /images/... path, then the local files can be deleted.
 *
 * Uses raw REST calls (not @supabase/supabase-js) — the JS client's realtime
 * websocket setup throws under plain `node -e`/script execution on Node 20.
 *
 * Usage: node scripts/upload-contractor-images.js [--limit N]
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const IMAGES_DIR = join(ROOT, 'images', 'contractors');
const MANIFEST_PATH = join(ROOT, 'content', 'data', 'contractor-images.json');
const BUCKET = 'contractor-images';
const MAX_WIDTH = 900;
const JPEG_QUALITY = 72;

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

async function uploadBuffer(path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const limitArg = process.argv.indexOf('--limit');
  const limit = limitArg !== -1 ? Number(process.argv[limitArg + 1]) : null;

  const manifest = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};
  let keys = Object.keys(manifest);
  if (limit) keys = keys.slice(0, limit);

  console.log(`Uploading ${keys.length} contractor photos to Supabase Storage...`);
  let ok = 0;
  let failed = 0;

  for (let i = 0; i < keys.length; i++) {
    const key = keys[i]; // "{state_slug}/{slug}"
    const entry = manifest[key];
    const localPath = join(ROOT, entry.path.replace(/^\//, ''));
    if (!existsSync(localPath)) {
      failed++;
      console.log(`  [${i + 1}/${keys.length}] ${key}: local file missing, skip`);
      continue;
    }

    try {
      const compressed = await sharp(localPath)
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      const storagePath = `${key}/hero.jpg`;
      const publicUrl = await uploadBuffer(storagePath, compressed, 'image/jpeg');
      manifest[key] = { ...entry, path: publicUrl, width: undefined, height: undefined };
      ok++;
      if (i % 100 === 0) console.log(`  [${i + 1}/${keys.length}] ${key}: OK`);
    } catch (err) {
      failed++;
      console.log(`  [${i + 1}/${keys.length}] ${key}: FAILED ${err.message}`);
    }

    if (i % 200 === 0) writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  }

  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
  console.log(`\nDone. ${ok} uploaded, ${failed} failed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
