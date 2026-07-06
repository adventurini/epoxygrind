#!/usr/bin/env node
/**
 * AI-generated fallback images for the handful of things a real photo
 * genuinely couldn't be recovered for (see fetch-product-images.js manifest):
 * two products still bot-blocked/WAF-blocked after repeated real-browser
 * attempts, plus the 4 shopping-list pages, which aren't a single product
 * so there's no merchant photo to fetch in the first place. Deliberately
 * brand-neutral prompts — never depict a specific product's real packaging/
 * label/logo, since we can't verify what we'd be drawing looks like the
 * actual item (spec §"don't fabricate a real commercial product's look").
 *
 * Usage: node scripts/generate-fallback-images.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'scratch-fallback-images');
mkdirSync(OUT_DIR, { recursive: true });

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const { generateImageWithFal } = await import(join(ROOT, 'lib', 'fal.js'));

const TARGETS = [
  {
    id: 'product-3m-6502ql-respirator',
    prompt:
      'Product photography of a generic reusable half-face respirator mask for industrial and workshop use, matte gray silicone body, two round replaceable filter cartridges (one on each cheek), adjustable elastic head straps, viewed at a three-quarter angle, isolated on a plain white studio background, soft even lighting, no text, no logos, no brand markings.',
  },
  {
    id: 'product-globmarble-quarter-inch-flake',
    prompt:
      'Close-up macro product photography of a loose pile of small decorative vinyl paint flakes/chips used for epoxy garage floor coatings, mixed neutral colors (gray, white, black, tan, beige), quarter-inch irregular flake shapes scattered and overlapping, isolated on a plain white background, studio lighting, no text, no logos, no packaging.',
  },
  {
    id: 'shopping-list-1-car',
    prompt:
      'Overhead flat-lay photography of epoxy garage floor coating supplies for a small one-car garage job: two unlabeled gallon buckets (one for resin, one for hardener), one paint roller with tray, one notched squeegee, a drill mixing paddle, blue nitrile gloves, a respirator mask, and painter\'s tape, neatly arranged on light gray concrete flooring, soft natural daylight, no text, no logos, no people.',
  },
  {
    id: 'shopping-list-2-car',
    prompt:
      'Overhead flat-lay photography of epoxy garage floor coating supplies for a medium two-car garage job: four unlabeled gallon buckets of resin and hardener, two paint rollers, a notched squeegee, a drill mixing paddle, a bag of decorative color flakes, blue nitrile gloves, a respirator mask, and painter\'s tape, neatly arranged on light gray concrete flooring, soft natural daylight, no text, no logos, no people.',
  },
  {
    id: 'shopping-list-3-car',
    prompt:
      'Overhead flat-lay photography of epoxy garage floor coating supplies for a large three-car garage job: six unlabeled gallon buckets of resin and hardener, several paint rollers, a notched squeegee, a drill mixing paddle, a diamond grinding cup wheel, a coiled dust-extractor hose, blue nitrile gloves, a respirator mask, and painter\'s tape, neatly arranged on light gray concrete flooring, wide overhead shot, soft natural daylight, no text, no logos, no people.',
  },
  {
    id: 'shopping-list-basement',
    prompt:
      'Overhead flat-lay photography of epoxy basement floor coating supplies: unlabeled cans of moisture-barrier primer, gallon buckets of epoxy resin and hardener, a paint roller, a notched squeegee, a drill mixing paddle, blue nitrile gloves, and a respirator mask, neatly arranged on a concrete basement floor with a hint of a plain foundation wall at the edge of frame, soft indoor lighting, no text, no logos, no people.',
  },
];

async function main() {
  const manifest = {};
  for (const t of TARGETS) {
    console.log(`\n[${t.id}] generating...`);
    try {
      const dataUrl = await generateImageWithFal(t.prompt);
      const b64 = dataUrl.split(',')[1];
      const buf = Buffer.from(b64, 'base64');
      const outPath = join(OUT_DIR, `${t.id}.jpg`);
      writeFileSync(outPath, buf);
      manifest[t.id] = { localPath: outPath, bytes: buf.length };
      console.log(`  OK: saved ${outPath} (${buf.length} bytes)`);
    } catch (err) {
      console.log(`  FAILED: ${err.message}`);
      manifest[t.id] = { error: err.message };
    }
  }
  writeFileSync(join(OUT_DIR, '_manifest.json'), JSON.stringify(manifest, null, 2));
  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
