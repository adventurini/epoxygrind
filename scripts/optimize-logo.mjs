#!/usr/bin/env node
// perf-fix directive Fix 1 — the header logo was a 1024x1024 PNG (610 KiB)
// rendered at ~32px. Generates small webp variants for the header <img> plus
// a properly-sized PNG for the Organization JSON-LD `logo` field (schema.org
// wants a real image, but not a 610 KiB one).
import sharp from 'sharp';

await sharp('logo.png').resize(64, 64).webp({ quality: 90 }).toFile('logo-64.webp');
await sharp('logo.png').resize(128, 128).webp({ quality: 90 }).toFile('logo-128.webp');
await sharp('logo.png').resize(512, 512).png({ quality: 90, compressionLevel: 9 }).toFile('logo-512.png');
console.log('wrote logo-64.webp, logo-128.webp, logo-512.png');
