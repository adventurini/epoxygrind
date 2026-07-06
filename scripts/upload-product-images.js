#!/usr/bin/env node
/**
 * Compresses and uploads the images downloaded by fetch-product-images.js
 * (scratch-product-images/*) to the public Supabase Storage bucket
 * `content-images` — same never-commit-binaries rule as contractor-images
 * (see scripts/upload-contractor-images.js). Prints a product_id -> public
 * URL manifest; product-registry.js image_url/verified_date/notes are then
 * hand-applied from that, same rationale as upload-contractor-images.js
 * for not touching the hand-maintained registry file by script.
 *
 * Usage: node scripts/upload-product-images.js [--dir path] [--prefix products]
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname, basename } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

const BUCKET = 'content-images';
const MAX_WIDTH = 900;
const JPEG_QUALITY = 78;

const dirArgIdx = process.argv.indexOf('--dir');
const SRC_DIR = dirArgIdx !== -1 ? process.argv[dirArgIdx + 1] : join(ROOT, 'scratch-product-images');
const prefixArgIdx = process.argv.indexOf('--prefix');
const PREFIX = prefixArgIdx !== -1 ? process.argv[prefixArgIdx + 1] : 'products';

async function uploadBuffer(path, buffer) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'true',
    },
    body: buffer,
  });
  if (!res.ok) throw new Error(`upload failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const files = readdirSync(SRC_DIR).filter((f) => /\.(jpe?g|png|webp|gif)$/i.test(extname(f)));
  console.log(`Uploading ${files.length} images from ${SRC_DIR} to ${BUCKET}/${PREFIX}/...`);

  const manifest = {};
  for (const file of files) {
    const productId = basename(file, extname(file));
    try {
      const compressed = await sharp(join(SRC_DIR, file))
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .flatten({ background: '#ffffff' })
        .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
        .toBuffer();
      const url = await uploadBuffer(`${PREFIX}/${productId}.jpg`, compressed);
      manifest[productId] = url;
      console.log(`  OK ${productId} -> ${url}`);
    } catch (err) {
      console.log(`  FAILED ${productId}: ${err.message}`);
    }
  }

  const outPath = join(SRC_DIR, '_uploaded.json');
  writeFileSync(outPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
