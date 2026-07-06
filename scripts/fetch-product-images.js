#!/usr/bin/env node
/**
 * One-time recovery pass for product-registry.js entries with image_url:
 * null. Amazon PDPs render client-side (plain fetch gets an empty shell,
 * per the registry header comment) so this uses headless Chromium via
 * Playwright for those; non-Amazon merchant sites usually expose an
 * og:image meta tag readable via plain fetch + a browser-like UA (same
 * approach already used manually for spartan/leggari entries), so those
 * are tried with plain fetch first and only fall back to Playwright.
 *
 * Does NOT write product-registry.js — outputs a JSON manifest for the
 * caller to review and hand-apply, since registry entries also need a
 * verified_date/notes update that's easier to get right by hand than by
 * scripted regex surgery on a hand-maintained source file.
 *
 * Usage: node scripts/fetch-product-images.js
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = process.env.PRODUCT_IMAGE_OUT_DIR || join(ROOT, 'scratch-product-images');
mkdirSync(OUT_DIR, { recursive: true });

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const CAPTCHA_SIGNS = [
  /Sorry, we just need to make sure/i,
  /api-services-support@amazon/i,
  /Enter the characters you see below/i,
  /captcha/i,
  /Access to this page has been denied/i,
  /Pardon Our Interruption/i,
];

async function plainFetchOgImage(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!res.ok) return { ok: false, reason: `http ${res.status}` };
  const html = await res.text();
  if (CAPTCHA_SIGNS.some((re) => re.test(html))) return { ok: false, reason: 'blocked/captcha page' };
  const m = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (!m) return { ok: false, reason: 'no og:image tag in plain fetch' };
  return { ok: true, imageUrl: m[1] };
}

// Amazon's bot check ("Continue shopping" interstitial) fires on
// navigator.webdriver === true; masking it is enough to get the real PDP
// without residential proxies/stealth plugins.
async function browserExtractImage(url, { isAmazon }) {
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ userAgent: UA, viewport: { width: 1280, height: 1600 }, locale: 'en-US' });
    await ctx.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });
    const page = await ctx.newPage();

    let bodyText = '';
    let title = '';
    for (let attempt = 0; attempt < 3; attempt++) {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
      await page.waitForTimeout(2500);
      bodyText = await page.evaluate(() => document.body.innerText || '');
      title = await page.title();
      if (!/Continue shopping/i.test(bodyText)) break;
      await page.waitForTimeout(3000);
    }
    if (CAPTCHA_SIGNS.some((re) => re.test(bodyText) || re.test(title)) || /Continue shopping/i.test(bodyText)) {
      return { ok: false, reason: 'blocked/captcha page (browser)' };
    }

    if (isAmazon) {
      const src = await page.evaluate(() => {
        const landing = document.querySelector('#landingImage');
        if (landing?.src) return landing.src;
        const wrap = document.querySelector('#imgTagWrapperId img');
        if (wrap?.src) return wrap.src;
        const og = document.querySelector('meta[property="og:image"]');
        if (og?.content) return og.content;
        const dpImg = document.querySelector('#imageBlock img, #main-image-container img');
        return dpImg?.src || null;
      });
      if (!src) return { ok: false, reason: 'no image element found on Amazon PDP' };
      // Amazon's own placeholder for "image unavailable" — treat as failure.
      if (/no-img-sm|1x1|s\.gif/i.test(src)) return { ok: false, reason: 'amazon placeholder image src' };
      return { ok: true, imageUrl: src };
    }

    const og = await page.evaluate(() => document.querySelector('meta[property="og:image"]')?.content || null);
    if (og) return { ok: true, imageUrl: og };

    const largest = await page.evaluate(() => {
      const BLOCKED_HOSTS = /google\.com|gstatic\.com|doubleclick|facebook\.com|gravatar|addthis|recaptcha/i;
      const imgs = Array.from(document.querySelectorAll('img'));
      let best = null;
      let bestArea = 0;
      for (const img of imgs) {
        if (BLOCKED_HOSTS.test(img.src)) continue;
        const area = (img.naturalWidth || 0) * (img.naturalHeight || 0);
        if (area > bestArea && img.naturalWidth > 300) {
          bestArea = area;
          best = img.src;
        }
      }
      return best;
    });
    if (largest) return { ok: true, imageUrl: largest };
    return { ok: false, reason: 'no og:image or large <img> found' };
  } finally {
    await browser.close();
  }
}

async function downloadAndValidate(imageUrl, refererUrl) {
  const res = await fetch(imageUrl, { headers: { 'User-Agent': UA, Referer: refererUrl } });
  if (!res.ok) return { ok: false, reason: `image download http ${res.status}` };
  const contentType = res.headers.get('content-type') || '';
  if (!/^image\//.test(contentType)) return { ok: false, reason: `not an image content-type: ${contentType}` };
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 2000) return { ok: false, reason: `suspiciously small (${buf.length} bytes) — likely placeholder/1x1` };
  return { ok: true, buffer: buf, contentType };
}

async function resolveOne(product) {
  const isAmazon = /amazon\.com/i.test(product.merchant) || /amazon\.com/i.test(product.url);
  console.log(`\n[${product.product_id}] ${product.url}`);

  let result;
  if (!isAmazon) {
    result = await plainFetchOgImage(product.url);
    if (result.ok) console.log(`  plain fetch og:image -> ${result.imageUrl}`);
    else console.log(`  plain fetch failed: ${result.reason} — trying browser`);
  }

  if (!result?.ok) {
    try {
      result = await browserExtractImage(product.url, { isAmazon });
      if (result.ok) console.log(`  browser extract -> ${result.imageUrl}`);
      else console.log(`  browser extract failed: ${result.reason}`);
    } catch (err) {
      result = { ok: false, reason: `browser error: ${err.message}` };
      console.log(`  browser error: ${err.message}`);
    }
  }

  if (!result.ok) return { product_id: product.product_id, recovered: false, reason: result.reason };

  const dl = await downloadAndValidate(result.imageUrl, product.url);
  if (!dl.ok) {
    console.log(`  download/validate failed: ${dl.reason}`);
    return { product_id: product.product_id, recovered: false, reason: dl.reason, sourceImageUrl: result.imageUrl };
  }

  const ext = dl.contentType.includes('png') ? 'png' : dl.contentType.includes('webp') ? 'webp' : 'jpg';
  const outPath = join(OUT_DIR, `${product.product_id}.${ext}`);
  writeFileSync(outPath, dl.buffer);
  console.log(`  OK: saved ${outPath} (${dl.buffer.length} bytes, ${dl.contentType})`);
  return { product_id: product.product_id, recovered: true, sourceImageUrl: result.imageUrl, localPath: outPath, bytes: dl.buffer.length };
}

async function main() {
  const { PRODUCTS } = await import(join(ROOT, 'lib', 'product-registry.js'));
  const only = process.argv[2] ? process.argv[2].split(',') : null;
  const targets = PRODUCTS.filter((p) => p.image_url === null && p.url && (!only || only.includes(p.product_id)));

  console.log(`Attempting recovery for ${targets.length} products with a fetchable URL...`);
  const results = [];
  for (const product of targets) {
    try {
      results.push(await resolveOne(product));
    } catch (err) {
      console.log(`  FATAL for ${product.product_id}: ${err.message}`);
      results.push({ product_id: product.product_id, recovered: false, reason: `fatal: ${err.message}` });
    }
  }

  const manifestPath = join(OUT_DIR, '_manifest.json');
  writeFileSync(manifestPath, JSON.stringify(results, null, 2));
  const recovered = results.filter((r) => r.recovered).length;
  console.log(`\nDone. ${recovered}/${results.length} recovered. Manifest: ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
