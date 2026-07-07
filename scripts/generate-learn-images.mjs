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
  // Mobile
  { slug: 'viewport-meta-tag', prompt: 'A clean flat-design illustration of a smartphone and desktop monitor side by side showing the same webpage scaling correctly to fit each screen, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'tap-target-size', prompt: 'A clean flat-design illustration of a large finger tapping a comfortably-sized button on a smartphone screen, with subtle size-guide dashed outlines, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'click-to-call-link', prompt: 'A clean flat-design illustration of a smartphone with a phone call icon connecting directly from a webpage to an active call screen, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'cta-reachable-while-scrolling', prompt: 'A clean flat-design illustration of a smartphone screen scrolling downward with a persistent button bar staying fixed at the bottom, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'no-horizontal-scroll', prompt: "A clean flat-design illustration of a webpage neatly contained within a smartphone screen's width, contrasted with a faint broken/overflowing version, blue and navy color palette, minimalist, professional, no text, no logos" },
  // Funnel
  { slug: 'primary-cta-above-the-fold', prompt: "A clean flat-design illustration of a webpage's very first screen with a glowing call-to-action button immediately visible, no scrolling implied, blue and navy color palette, minimalist, professional, no text, no logos" },
  { slug: 'phone-number-above-the-fold', prompt: 'A clean flat-design illustration of a website header bar with a prominent phone number and icon at the very top, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'click-to-call', prompt: 'A clean flat-design illustration of a phone call icon with an upward conversion arrow, contrasted faintly with a dimmer form/document icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'chat-widget', prompt: 'A clean flat-design illustration of a website with a chat bubble widget open in the corner, a friendly conversational UI, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'response-time-expectation-set', prompt: 'A clean flat-design illustration of a stopwatch next to a chat/message bubble, conveying a fast reply, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'trust-signals-near-the-cta', prompt: 'A clean flat-design illustration of a quote-request button surrounded by small trust badge icons — shield, star rating, checkmark, blue and navy color palette, minimalist, professional, no text, no logos' },
  // SEO
  { slug: 'title-tag', prompt: 'A clean, modern flat-design illustration of a browser search results page with one highlighted blue link title, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'meta-description', prompt: 'A clean, modern flat-design illustration of a magnifying glass over a document with two highlighted text lines, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'single-h1', prompt: 'A clean, modern flat-design illustration of a document outline with one large heading bar and smaller subheading bars beneath it, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'image-alt-text-coverage', prompt: 'A clean, modern flat-design illustration of a photo frame with a small text label tag attached to the corner, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'localbusiness-schema', prompt: 'A clean, modern flat-design illustration of a map pin connected by dotted lines to a small code bracket icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'sitemap-robots-txt', prompt: 'A clean, modern flat-design illustration of a folder tree structure with a checklist icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'city-service-landing-pages', prompt: 'A clean, modern flat-design illustration of a map with multiple location pins each connected to a small page icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  // Security
  { slug: 'valid-ssl-https', prompt: 'A clean, modern flat-design illustration of a browser address bar with a padlock icon transitioning from unlocked/warning to locked/secure, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'no-mixed-content', prompt: 'A clean, modern flat-design illustration of a broken puzzle piece or missing image icon inside a webpage layout, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'custom-domain', prompt: 'A clean, modern flat-design illustration of a website URL bar showing a custom domain versus a cluttered subdomain address, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'console-errors-on-load', prompt: 'A clean, modern flat-design illustration of a browser developer console panel with a small warning triangle icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'favicon-present', prompt: 'A clean, modern flat-design illustration of browser tabs, one with a generic blank icon and one with a distinct small logo icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  // Performance
  { slug: 'largest-contentful-paint', prompt: 'A clean, modern flat-design illustration of a stopwatch overlaid on a webpage hero image loading progressively, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'total-page-weight', prompt: 'A clean, modern flat-design illustration of a webpage with a heavy weight/dumbbell icon next to an image thumbnail, blue and navy color palette, minimalist, professional, no text, no logos' },
  // Local presence
  { slug: 'google-business-profile-photos', prompt: 'A clean, modern flat-design illustration of a smartphone camera capturing a photo of a garage floor, with a small Google Maps pin icon nearby, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'review-count-vs-local-median', prompt: 'A clean, modern flat-design illustration of a bar chart comparing review-count stacks between businesses, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'nap-consistency-phone', prompt: 'A clean, modern flat-design illustration of two phone/directory listing cards with a mismatched phone number highlighted, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'reviews-displayed-on-site', prompt: 'A clean, modern flat-design illustration of a webpage with star-rating review cards next to a contact form, blue and navy color palette, minimalist, professional, no text, no logos' },
  // Image quality
  { slug: 'real-project-photos', prompt: 'A clean, modern flat-design illustration of a smartphone photographing a finished garage floor, contrasted with a crossed-out generic stock photo icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'before-after-photo', prompt: 'A clean, modern flat-design illustration of a split-screen before/after garage floor comparison, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'image-technical-quality', prompt: 'A clean, modern flat-design illustration contrasting a sharp photo with a blurry/pixelated stretched photo, blue and navy color palette, minimalist, professional, no text, no logos' },
  // Site structure
  { slug: 'broken-links', prompt: 'A clean, modern flat-design illustration of a broken chain link icon next to a webpage/browser window outline, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'unique-title-tags-across-pages', prompt: 'A clean, modern flat-design illustration of several browser tabs each with a unique label/tag icon, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'unique-meta-descriptions-across-pages', prompt: 'A clean, modern flat-design illustration of a search results page with one highlighted text snippet under a webpage title, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'open-graph-tags-across-pages', prompt: 'A clean, modern flat-design illustration of a smartphone showing a chat message with a link preview card (image + title placeholder), blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'phone-number-consistency-across-pages', prompt: 'A clean, modern flat-design illustration of a phone handset icon with a checkmark, repeated consistently across three stacked webpage outlines, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'contact-cta-presence-across-pages', prompt: 'A clean, modern flat-design illustration of multiple webpage outlines each with a small phone/contact button visible, blue and navy color palette, minimalist, professional, no text, no logos' },
  { slug: 'image-alt-text-coverage-sitewide', prompt: 'A clean, modern flat-design illustration of a photo grid where each image has a small text-tag label attached, blue and navy color palette, minimalist, professional, no text, no logos' },
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
