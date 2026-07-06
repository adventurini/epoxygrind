#!/usr/bin/env node
/**
 * Generates the full favicon/app-icon set from the master logo.png
 * (1024x1024, source of truth) — run after logo.png changes.
 * Google's own favicon guidelines want a real (not browser-scaled) square
 * icon at a stable URL, ideally with multiple sizes + a manifest for
 * Android/PWA "add to home screen"; Apple wants its own 180x180 touch icon.
 *
 * favicon.ico is hand-packed here (PNG-in-ICO container, RFC-valid and
 * supported by every current browser) rather than pulling in an ICO
 * library for a one-time build script.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'logo.png');

const PNG_TARGETS = [
  { file: 'favicon-16x16.png', size: 16 },
  { file: 'favicon-32x32.png', size: 32 },
  { file: 'favicon-48x48.png', size: 48 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'android-chrome-192x192.png', size: 192 },
  { file: 'android-chrome-512x512.png', size: 512 },
];

/** Minimal ICO container holding one or more PNG-encoded images (the
 * modern, widely-supported ICO variant — no BMP/DIB encoding needed). */
function packIco(pngBuffers) {
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const dataOffset0 = headerSize + dirEntrySize * count;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = icon
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  let offset = dataOffset0;
  for (const { size, buffer } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    entry.writeUInt8(size >= 256 ? 0 : size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buffer.length, 8); // image data size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buffer.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map((p) => p.buffer)]);
}

async function main() {
  for (const { file, size } of PNG_TARGETS) {
    const buf = await sharp(SOURCE).resize(size, size).png().toBuffer();
    writeFileSync(join(ROOT, file), buf);
    console.log(`  wrote ${file} (${size}x${size})`);
  }

  const icoSizes = [16, 32, 48];
  const icoPngs = [];
  for (const size of icoSizes) {
    const buffer = await sharp(SOURCE).resize(size, size).png().toBuffer();
    icoPngs.push({ size, buffer });
  }
  writeFileSync(join(ROOT, 'favicon.ico'), packIco(icoPngs));
  console.log('  wrote favicon.ico (16/32/48 multi-size)');

  const manifest = {
    name: 'EpoxyGrind',
    short_name: 'EpoxyGrind',
    icons: [
      { src: '/android-chrome-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: '/android-chrome-512x512.png', sizes: '512x512', type: 'image/png' },
    ],
    theme_color: '#1A5CD6',
    background_color: '#FFFFFF',
    display: 'standalone',
  };
  writeFileSync(join(ROOT, 'site.webmanifest'), JSON.stringify(manifest, null, 2));
  console.log('  wrote site.webmanifest');

  console.log('\nDone.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
