#!/usr/bin/env node
/**
 * Generates + uploads hero images for contractor learning-center articles.
 * Abstract concept illustrations (no real photo exists for "page speed" or
 * "lead form conversion"), so always AI-generated — same fal.ai pipeline
 * already used for shopping-list images, uploaded to the same Supabase
 * bucket/prefix convention.
 *
 * Usage: node scripts/generate-learn-images.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
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

const { generateImageWithFal } = await import('../lib/fal.js');

const MANIFEST_PATH = join(ROOT, 'content', 'data', 'learn-images.json');
const MANIFEST = existsSync(MANIFEST_PATH) ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) : {};

const TARGETS = [
  {
    slug: 'lighthouse-performance-score',
    prompt: 'A clean, modern flat-design illustration of a website speed gauge/speedometer dashboard UI, blue and navy color palette, minimalist, professional, no text, no logos',
  },
  {
    slug: 'lead-form',
    prompt: 'A clean, modern flat-design illustration of a simple contact form on a laptop screen with a cursor clicking a submit button, blue and navy color palette, minimalist, professional, no text, no logos',
  },
  {
    slug: 'google-rating',
    prompt: 'A clean, modern flat-design illustration of a five-star rating with a map location pin, representing local business reviews, blue and navy color palette, minimalist, professional, no text, no logos',
  },
];

for (const { slug, prompt } of TARGETS) {
  if (MANIFEST[slug]) {
    console.log(`  ${slug}: already have an image, skipping`);
    continue;
  }
  try {
    const dataUrl = await generateImageWithFal(prompt);
    const base64 = dataUrl.split(',')[1];
    const buf = Buffer.from(base64, 'base64');
    const webp = await sharp(buf).resize({ width: 1200, withoutEnlargement: true }).webp({ quality: 82 }).toBuffer();

    const objectPath = `learn/${slug}.webp`;
    const upRes = await fetch(`${SUPABASE_URL}/storage/v1/object/content-images/${objectPath}`, {
      method: 'POST',
      headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/webp', 'x-upsert': 'true' },
      body: webp,
    });
    if (!upRes.ok) throw new Error(`upload ${upRes.status} ${await upRes.text()}`);

    const publicUrl = `${SUPABASE_URL}/storage/v1/object/public/content-images/${objectPath}`;
    MANIFEST[slug] = { path: publicUrl, generated: true };
    console.log(`  ${slug}: wrote ${publicUrl}`);
  } catch (err) {
    console.error(`  FAILED ${slug}: ${err.message}`);
  }
}

writeFileSync(MANIFEST_PATH, JSON.stringify(MANIFEST, null, 2) + '\n');
console.log('\nWrote', MANIFEST_PATH);
