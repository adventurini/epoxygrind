#!/usr/bin/env node
/**
 * Visual QA harness for lib/flake-texture-renderer.js — renders sample
 * textures to real PNG files via @napi-rs/canvas (same library the
 * carousel compositor uses) so they can be inspected during tuning,
 * without needing a browser. Not part of the shipped site.
 *
 * Usage: node scripts/qa-flake-renderer.mjs
 */
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderFlakeTexture, defaultSeedFor } from '../lib/flake-texture-renderer.js';
import { getBlendRecipe, resolveRenderComponents } from '../lib/flake-recipes.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'scratch-flake-qa');
mkdirSync(OUT_DIR, { recursive: true });

const SIZE = 1024;
const BASE_COAT_HEX = '#4A4F54'; // charcoal, matches finish-design.js's charcoal base

function render(name, { blendId, customComponents, density = 1, flakeSizeIn = 0.25 }) {
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext('2d');
  const components = resolveRenderComponents({ blendId, customComponents });
  const seed = defaultSeedFor(density, flakeSizeIn);
  renderFlakeTexture({ size: SIZE, baseCoatHex: BASE_COAT_HEX, components, density, flakeSizeIn, seed }, ctx);
  const buf = canvas.toBuffer('image/png');
  const outPath = join(OUT_DIR, `${name}.png`);
  writeFileSync(outPath, buf);
  console.log(`wrote ${outPath}`);
}

render('domino-full', { blendId: 'domino', density: 1, flakeSizeIn: 0.25 });
render('gravel-full', { blendId: 'gravel', density: 1, flakeSizeIn: 0.25 });
render('tidal-wave-full', { blendId: 'tidal-wave', density: 1, flakeSizeIn: 0.25 });
render('gravel-medium-density', { blendId: 'gravel', density: 0.5, flakeSizeIn: 0.25 });
render('gravel-light-density', { blendId: 'gravel', density: 0.25, flakeSizeIn: 0.25 });
render('gravel-large-flake', { blendId: 'gravel', density: 1, flakeSizeIn: 0.5 });
render('gravel-small-flake', { blendId: 'gravel', density: 1, flakeSizeIn: 0.0625 });
render('custom-bold-blend', {
  customComponents: [
    { colorCode: 'F9920', pct: 40 }, // Cherry Bomb red
    { colorCode: 'F1050', pct: 30 }, // Black
    { colorCode: 'F1820', pct: 30 }, // White
  ],
  density: 1,
  flakeSizeIn: 0.25,
});

console.log('\nDone. Inspect PNGs in scratch-flake-qa/');
