#!/usr/bin/env node
/**
 * Generates 4 accurate service-card images for /demo/ (residential,
 * commercial, industrial, decorative-concrete) via the same fal.ai
 * pipeline as the gallery. Replaces Unsplash stock photos that were
 * picked by loose keyword match and didn't actually depict what their
 * card claimed (a house exterior for "Residential Epoxy Floors", a
 * living room for "Commercial", a lab-equipment photo for "Industrial",
 * a dining room for "Decorative Concrete" — confirmed via screenshot,
 * none showed an actual coated floor).
 *
 * Usage: node scripts/generate-demo-services-images.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BUCKET = 'contractor-images';
const PREFIX = 'demo-services';

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const { generateImageWithFal } = await import(join(ROOT, 'lib', 'fal.js'));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set (check .env.local)');

const TARGETS = [
  {
    id: 'residential',
    prompt: 'Photo of a finished residential garage floor with a glossy full-flake epoxy coating in gray and charcoal chip blend, clean and modern, garage door open to daylight, wide angle, realistic, no people, no text, no logos.',
  },
  {
    id: 'commercial',
    prompt: 'Photo of a finished commercial retail showroom floor with a glossy quartz-broadcast epoxy coating in light gray and white tones, clean modern retail interior with shelving visible at the edges, wide angle, realistic, no people, no text, no logos.',
  },
  {
    id: 'industrial',
    prompt: 'Photo of a finished industrial warehouse floor with a heavy-duty gray urethane cement coating, wide shot showing steel pallet racking and warehouse equipment in the background, realistic industrial lighting, no people, no text, no logos.',
  },
  {
    id: 'decorative-concrete',
    prompt: 'Photo of a finished decorative concrete patio floor, poured concrete stamped with a clearly visible ashlar-slate or running-bond brick pattern (real stamped-concrete texture — raised pattern lines pressed into a single continuous concrete slab, NOT individual stone pavers, NOT a smooth blank surface), warm brown/tan color with a subtle darker accent stain in the recessed lines, outdoor residential patio setting visible at the edges, natural daylight, shot from a slight angle showing the pattern clearly across the floor, photorealistic, no people, no text, no logos.',
  },
];

async function uploadDataUrl(path, dataUrl) {
  const b64 = dataUrl.split(',')[1];
  const buf = Buffer.from(b64, 'base64');
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'image/jpeg', 'x-upsert': 'true' },
    body: buf,
  });
  if (!res.ok) throw new Error(`upload failed for ${path}: ${res.status} ${await res.text()}`);
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
}

async function main() {
  const manifest = {};
  for (const t of TARGETS) {
    console.log(`[${t.id}] generating...`);
    const dataUrl = await generateImageWithFal(t.prompt);
    const path = `${PREFIX}/${t.id}.jpg`;
    const url = await uploadDataUrl(path, dataUrl);
    manifest[t.id] = url;
    console.log(`  OK: ${url}`);
  }
  writeFileSync(join(ROOT, 'demo', 'services-images.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone. Wrote demo/services-images.json');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
