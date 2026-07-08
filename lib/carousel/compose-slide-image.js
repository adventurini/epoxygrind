import sharp from 'sharp';
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const FONT_PATH = join(ROOT, 'fonts/ibm-plex-mono-500.woff2');
const FONT_FAMILY = 'IBMPlexMonoCarousel';

// Spec asked for "modern, courier style" — IBM Plex Mono is the project's
// actual self-hosted monospace brand font (used throughout the admin UI
// already), which reads as a modern take on a typewriter/courier face.
// Geist Mono (mentioned in the original spec doc) was never actually
// added to this repo's font set, so this avoids a new asset dependency.
//
// Renders via @napi-rs/canvas rather than an SVG passed through sharp's
// built-in rsvg renderer — confirmed by direct test that rsvg/pango in
// this environment silently ignores an embedded @font-face data URI and
// falls back to a generic system font, so the "modern courier" look never
// actually applied. @napi-rs/canvas registers the font file directly,
// with no CSS/@font-face indirection to fail.
let fontRegistered = false;
function ensureFontRegistered() {
  if (!fontRegistered) {
    GlobalFonts.registerFromPath(FONT_PATH, FONT_FAMILY);
    fontRegistered = true;
  }
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1350;
const FONT_SIZE = 56;
const LINE_HEIGHT = 66;
const BAND_PADDING = 40;
const MAX_TEXT_WIDTH = CANVAS_WIDTH - 120; // 60px margin each side

function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Burns the slide's caption onto its generated image as a top-band
 * overlay (spec §3's text-overlay concept, auto-applied rather than
 * gated behind a manual approval step for now). Character framing (small,
 * lower half of frame) is handled at generation time — see
 * generate-image.js's FRAMING_BLOCK — not here.
 * @param {{ baseImageBuffer: Buffer, caption: string }} opts
 * @returns {Promise<Buffer>} composited JPEG buffer, 1080x1350
 */
export async function composeSlideImage({ baseImageBuffer, caption }) {
  ensureFontRegistered();

  const measureCanvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const measureCtx = measureCanvas.getContext('2d');
  measureCtx.font = `500 ${FONT_SIZE}px "${FONT_FAMILY}"`;
  const lines = wrapText(measureCtx, caption, MAX_TEXT_WIDTH);

  const canvas = createCanvas(CANVAS_WIDTH, CANVAS_HEIGHT);
  const ctx = canvas.getContext('2d');

  // Anthony: plain black font, no outline, no background band — just the
  // text sitting directly on the image above the character.
  ctx.font = `500 ${FONT_SIZE}px "${FONT_FAMILY}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#000000';

  lines.forEach((line, i) => {
    const y = BAND_PADDING + FONT_SIZE * 0.8 + i * LINE_HEIGHT;
    ctx.fillText(line, CANVAS_WIDTH / 2, y);
  });

  const overlayPng = canvas.toBuffer('image/png');

  const base = await sharp(baseImageBuffer).resize(CANVAS_WIDTH, CANVAS_HEIGHT, { fit: 'cover' }).toBuffer();

  return sharp(base)
    .composite([{ input: overlayPng, top: 0, left: 0 }])
    .jpeg({ quality: 88 })
    .toBuffer();
}
