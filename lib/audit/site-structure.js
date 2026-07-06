import { chromium } from 'playwright';

/**
 * Site-wide structure crawl — runs AFTER the single-page crawlSite() (which
 * still does the expensive Playwright/Lighthouse/AI-vision work homepage-only).
 * This walks the rest of the site with plain HTTP fetch + regex HTML parsing
 * (no browser, no cheerio dep) so it stays near-free across thousands of
 * sites. A page only gets a real headless-browser reload if it looks like a
 * JS-rendered shell (very little text but a 200 status) — most contractor
 * sites (WordPress/Wix/Squarespace/GoDaddy/Weebly) render server-side, so
 * that fallback should be rare.
 *
 * Also builds the flat internal URL list the master spec wants for future
 * site-rebuild/SEO work — not just a score.
 */

const MAX_PAGES = 40;
const FETCH_TIMEOUT_MS = 10_000;
const THIN_PAGE_CHAR_THRESHOLD = 300;
const USER_AGENT = 'Mozilla/5.0 (compatible; EpoxyGrindAuditBot/1.0; +https://www.epoxygrind.com/bot)';
const SKIP_EXTENSION_RE = /\.(pdf|jpg|jpeg|png|gif|svg|webp|ico|css|js|zip|mp4|mov|avi|doc|docx|xls|xlsx|woff2?|ttf|eot)$/i;
const CTA_RE = /call|quote|estimate|book|schedule|contact us|get started|free (inspection|consultation|estimate)/i;

function normalizePhone(raw) {
  return String(raw || '').replace(/\D/g, '').replace(/^1/, '');
}

function normalizeUrl(href) {
  try {
    const u = new URL(href);
    u.hash = '';
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    return u.toString();
  } catch {
    return null;
  }
}

function extractAttr(tag, attr) {
  const m = tag.match(new RegExp(`${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? m[1] : '';
}

function parseHtml(html, pageUrl) {
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim();

  const metaTags = [...html.matchAll(/<meta\s+[^>]*>/gi)].map((m) => m[0]);
  let metaDescription = '';
  const og = {};
  let canonical = '';
  for (const tag of metaTags) {
    const name = extractAttr(tag, 'name').toLowerCase();
    const property = extractAttr(tag, 'property').toLowerCase();
    const content = extractAttr(tag, 'content');
    if (name === 'description') metaDescription = content;
    if (property.startsWith('og:')) og[property.slice(3)] = content;
  }
  const canonicalMatch = html.match(/<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*>/i);
  if (canonicalMatch) canonical = extractAttr(canonicalMatch[0], 'href');

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;

  const hasTelLink = /<a\s+[^>]*href\s*=\s*["']tel:/i.test(html);
  const hasForm = /<form[\s>]/i.test(html);

  const linkTags = [...html.matchAll(/<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>(.*?)<\/a>/gis)];
  const ctaHit = linkTags.some(([, , text]) => CTA_RE.test(text.replace(/<[^>]+>/g, ' ')));

  const links = [];
  for (const [, href] of linkTags) {
    if (!href || href.startsWith('#') || /^(mailto|tel|javascript):/i.test(href)) continue;
    try {
      const abs = new URL(href, pageUrl).toString();
      links.push(abs);
    } catch {
      // ignore malformed hrefs
    }
  }

  const imgTags = [...html.matchAll(/<img\s+[^>]*>/gi)].map((m) => m[0]);
  const imageCount = imgTags.length;
  const missingAltCount = imgTags.filter((tag) => {
    const alt = extractAttr(tag, 'alt');
    return !alt.trim();
  }).length;

  let jsonLdValid = true;
  const jsonLdBlocks = [...html.matchAll(/<script\s+type\s*=\s*["']application\/ld\+json["'][^>]*>(.*?)<\/script>/gis)];
  for (const [, body] of jsonLdBlocks) {
    try {
      JSON.parse(body);
    } catch {
      jsonLdValid = false;
    }
  }

  const bodyText = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    title,
    metaDescription,
    og,
    canonical,
    h1Count,
    hasTelLink,
    hasForm,
    ctaHit,
    links,
    imageCount,
    missingAltCount,
    jsonLdValid: jsonLdBlocks.length ? jsonLdValid : null,
    bodyText,
    wordCount: bodyText ? bodyText.split(/\s+/).length : 0,
  };
}

async function fetchOnce(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: controller.signal,
    });
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return { statusCode: res.status, html: null, finalUrl: res.url };
    }
    const html = await res.text();
    return { statusCode: res.status, html, finalUrl: res.url };
  } finally {
    clearTimeout(timer);
  }
}

// One retry — slow/flaky origin servers are common enough across thousands of
// small-business sites that a single transient timeout shouldn't report a
// working page as broken (especially costly if it's the homepage itself).
async function fetchPage(url) {
  try {
    return await fetchOnce(url);
  } catch (err) {
    try {
      return await fetchOnce(url);
    } catch (err2) {
      return { statusCode: null, html: null, finalUrl: url, error: err2.message };
    }
  }
}

let sharedBrowser = null;
async function renderWithBrowser(url) {
  try {
    if (!sharedBrowser) sharedBrowser = await chromium.launch();
    const page = await sharedBrowser.newPage();
    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 15_000 }).catch(() =>
        page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15_000 }),
      );
      const html = await page.content();
      return html;
    } finally {
      await page.close().catch(() => {});
    }
  } catch {
    return null;
  }
}

export async function crawlSiteStructure(baseUrl, { knownPhones = [], maxPages = MAX_PAGES } = {}) {
  const normalizedKnownPhones = knownPhones.map(normalizePhone).filter(Boolean);
  let host;
  try {
    host = new URL(baseUrl).hostname;
  } catch {
    return { ok: false, error: 'invalid base URL' };
  }
  let hostResolved = false; // the homepage often redirects to a different host (bare -> www, etc.); lock the real one in once we see it, so same-host link checks below don't reject every discovered link

  const visited = new Set();
  const queued = new Set();
  const startUrl = normalizeUrl(baseUrl) || baseUrl;
  const queue = [startUrl];
  queued.add(startUrl);
  const pages = [];
  const brokenLinks = [];
  const discoveredNotCrawled = new Set();
  let cappedAtMax = false;

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    if (SKIP_EXTENSION_RE.test(new URL(url).pathname)) continue;

    const { statusCode, html, finalUrl, error } = await fetchPage(url);

    if (error || statusCode == null || statusCode >= 400) {
      brokenLinks.push({ url, statusCode: statusCode ?? null, error: error || null });
      continue;
    }
    if (!html) continue; // non-HTML resource, already fetched-and-discarded

    if (!hostResolved) {
      try {
        host = new URL(finalUrl || url).hostname;
      } catch {
        // keep the original host guess
      }
      hostResolved = true;
    }

    let parsed = parseHtml(html, finalUrl || url);
    let renderedViaBrowser = false;

    if (parsed.wordCount * 6 < THIN_PAGE_CHAR_THRESHOLD && !parsed.hasForm && !parsed.hasTelLink) {
      const renderedHtml = await renderWithBrowser(finalUrl || url);
      if (renderedHtml) {
        parsed = parseHtml(renderedHtml, finalUrl || url);
        renderedViaBrowser = true;
      }
    }

    const napPhoneMatch = normalizedKnownPhones.length
      ? normalizedKnownPhones.some((p) => parsed.bodyText.replace(/\D/g, '').includes(p))
      : null;

    pages.push({
      url: finalUrl || url,
      statusCode,
      title: parsed.title,
      metaDescription: parsed.metaDescription,
      og: parsed.og,
      canonical: parsed.canonical,
      h1Count: parsed.h1Count,
      wordCount: parsed.wordCount,
      hasTelLink: parsed.hasTelLink,
      hasForm: parsed.hasForm,
      ctaHit: parsed.ctaHit,
      imageCount: parsed.imageCount,
      missingAltCount: parsed.missingAltCount,
      jsonLdValid: parsed.jsonLdValid,
      napPhoneMatch,
      renderedViaBrowser,
    });

    for (const link of parsed.links) {
      let sameHost;
      try {
        sameHost = new URL(link).hostname === host;
      } catch {
        sameHost = false;
      }
      if (!sameHost) continue;
      const norm = normalizeUrl(link);
      if (!norm || visited.has(norm) || queued.has(norm)) continue;
      if (pages.length + queue.length >= maxPages) {
        discoveredNotCrawled.add(norm);
        continue;
      }
      queued.add(norm);
      queue.push(norm);
    }
  }
  if (queue.length) {
    cappedAtMax = true;
    queue.forEach((u) => discoveredNotCrawled.add(u));
  }

  if (sharedBrowser) {
    await sharedBrowser.close().catch(() => {});
    sharedBrowser = null;
  }

  const titleGroups = new Map();
  const descGroups = new Map();
  for (const p of pages) {
    if (p.title) {
      if (!titleGroups.has(p.title)) titleGroups.set(p.title, []);
      titleGroups.get(p.title).push(p.url);
    }
    if (p.metaDescription) {
      if (!descGroups.has(p.metaDescription)) descGroups.set(p.metaDescription, []);
      descGroups.get(p.metaDescription).push(p.url);
    }
  }
  const duplicateTitles = [...titleGroups.entries()].filter(([, urls]) => urls.length > 1).map(([title, urls]) => ({ title, urls }));
  const duplicateMetaDescriptions = [...descGroups.entries()].filter(([, urls]) => urls.length > 1).map(([desc, urls]) => ({ description: desc, urls }));
  const missingTitleUrls = pages.filter((p) => !p.title).map((p) => p.url);
  const missingMetaUrls = pages.filter((p) => !p.metaDescription).map((p) => p.url);
  const missingOgUrls = pages.filter((p) => !p.og.title && !p.og.description).map((p) => p.url);

  const phoneRelevantPages = pages.filter((p) => p.napPhoneMatch !== null);
  const napConsistencyPct = phoneRelevantPages.length
    ? Math.round((phoneRelevantPages.filter((p) => p.napPhoneMatch).length / phoneRelevantPages.length) * 100)
    : null;

  return {
    ok: true,
    pageCount: pages.length,
    cappedAtMax,
    pages,
    brokenLinks,
    duplicateTitles,
    duplicateMetaDescriptions,
    missingTitleUrls,
    missingMetaUrls,
    missingOgUrls,
    napConsistencyPct,
    urlList: [...new Set([...pages.map((p) => p.url), ...discoveredNotCrawled])],
  };
}
