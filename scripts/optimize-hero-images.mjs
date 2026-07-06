#!/usr/bin/env node
// perf-fix directive Fix 2 — responsive widths for the before/after hero
// slider images so mobile doesn't download the full 1200px source.
import sharp from 'sharp';

const WIDTHS = [480, 640, 720, 960, 1280];
for (const name of ['hero-after', 'hero-before']) {
  for (const w of WIDTHS) {
    await sharp(`images/${name}.webp`).resize(w).webp({ quality: 82 }).toFile(`images/${name}-${w}.webp`);
  }
}
console.log('wrote', WIDTHS.map((w) => `hero-{after,before}-${w}.webp`).join(', '));
