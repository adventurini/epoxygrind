#!/usr/bin/env node
/**
 * Generates sitemap.xml for the current site (per the Master SEO & Sitemap
 * spec, §2 and §1). Only two content pages exist today (/, /services/) — the
 * spec's programmatic sections (state/city hubs, contractor directories,
 * service subpages, guides, /colors, /pros) aren't built yet. Each of those
 * is modeled below as an empty data array; populate it when that page type
 * ships and this script starts emitting it automatically — no rewrite
 * needed. Once more than one section has entries, this switches from a
 * single sitemap.xml to a sitemap index + one child file per template
 * (matching spec §2: "per-template sitemaps exist so GSC indexing can be
 * monitored per template").
 */
import { writeFileSync, readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { METROS, allStateSlugs } from '../lib/metros.js';
import { CONTRACTORS } from '../lib/contractors.js';

// TODO: switch to https://epoxygrind.com once the custom domain is
// connected in Vercel (Supabase auth is already configured for it, but no
// domain is registered on the Vercel project yet as of this writing).
const SITE_URL = 'https://www.epoxygrind.com';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DATA_DIR = join(ROOT, 'content', 'data');

/** Real lastmod, not a build-time stamp: the source file's own last git
 * commit date. Falls back to today only for an uncommitted/new file or if
 * git isn't available (e.g. a shallow CI checkout) — never crashes the build. */
const lastmodCache = new Map();
function gitLastModified(relPath) {
  if (lastmodCache.has(relPath)) return lastmodCache.get(relPath);
  let result;
  try {
    const out = execFileSync('git', ['log', '-1', '--format=%aI', '--', relPath], { cwd: ROOT, encoding: 'utf8' }).trim();
    result = out ? out.slice(0, 10) : new Date().toISOString().slice(0, 10);
  } catch {
    result = new Date().toISOString().slice(0, 10);
  }
  lastmodCache.set(relPath, result);
  return result;
}

/** Slugs come from data-file names (content/data/{subdir}/{slug}.js) — the
 * build-content.js convention this repo follows keeps filename === data.slug. */
function listSlugs(subdir) {
  const dir = join(CONTENT_DATA_DIR, subdir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => f.replace(/\.js$/, ''));
}

// ── Pages that exist today ───────────────────────────────────────────────
const STATIC_PAGES = [
  { path: '/', changefreq: 'weekly', priority: 1.0, lastmod: gitLastModified('index.html') },
  { path: '/services/', changefreq: 'weekly', priority: 0.9, lastmod: gitLastModified('services/index.html') },
  { path: '/pricing/', changefreq: 'weekly', priority: 0.9, lastmod: gitLastModified('pricing/index.html') },
  { path: '/audit/', changefreq: 'weekly', priority: 0.8, lastmod: gitLastModified('audit/index.html') },
  { path: '/epoxy-flooring/', changefreq: 'weekly', priority: 0.8, lastmod: gitLastModified('content/data/metros.json') },
  { path: '/contractors/', changefreq: 'weekly', priority: 0.8, lastmod: gitLastModified('content/data/enriched.json') },
];

// ── DIY & Product Content spec (spec_2) — auto-discovered from content/data/ ─
const RANKING_PAGES = listSlugs('rankings');
const REVIEW_PAGES = listSlugs('reviews');
const COMPARE_PAGES = listSlugs('compare');
const DIY_GUIDE_PAGES = listSlugs('diy');
const SHOPPING_LIST_PAGES = listSlugs('shopping-lists');
const HAS_DIY_HUB = existsSync(join(CONTENT_DATA_DIR, 'diy-hub.js'));
const HAS_DIY_VS_PRO_PILLAR = existsSync(join(CONTENT_DATA_DIR, 'diy-vs-pro-pillar.js'));
const HAS_COMPARE_HUB = existsSync(join(CONTENT_DATA_DIR, 'compare-hub.js'));

// ── Master SEO spec (spec_4) local pages — from content/data/metros.json ─
// State rollups: all 51. City hubs: every metro (331) — an explicit owner
// decision to skip the spec's phased Tier 1 → GSC-checkpoint → Tier 2 gate.
const STATE_PAGES = allStateSlugs().map((state) => ({ state }));
const CITY_PAGES = METROS.map((m) => ({ state: m.state_slug, city: m.slug }));
const METROS_LASTMOD = gitLastModified('content/data/metros.json');
const ENRICHED_LASTMOD = gitLastModified('content/data/enriched.json');

// ── Spec §1 sections, not built yet — populate as each ships ────────────
/** @type {{ state: string, city: string }[]} */
const DIRECTORY_PAGES = [];
/** @type {{ state: string, city: string, service: string }[]} */
const SERVICE_PAGES = [];
/** @type {{ slug: string }[]} */
const GUIDE_PAGES = listSlugs('guides').map((slug) => ({ slug }));
/** @type {{ slug: string }[]} */
const COLOR_PAGES = [];
/** @type {{ path: string, changefreq?: string, priority?: number }[]} */
const PROS_PAGES = [];

const sections = [
  { name: 'static', entries: STATIC_PAGES },
  {
    name: 'states',
    entries: STATE_PAGES.map(({ state }) => ({
      path: `/epoxy-flooring/${state}/`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: METROS_LASTMOD,
    })),
  },
  {
    name: 'cities',
    entries: CITY_PAGES.map(({ state, city }) => ({
      path: `/epoxy-flooring/${state}/${city}/`,
      changefreq: 'weekly',
      priority: 0.7,
      lastmod: METROS_LASTMOD,
    })),
  },
  {
    name: 'directories',
    entries: DIRECTORY_PAGES.map(({ state, city }) => ({
      path: `/epoxy-flooring/${state}/${city}/contractors/`,
      changefreq: 'weekly',
      priority: 0.7,
    })),
  },
  {
    name: 'services',
    entries: SERVICE_PAGES.map(({ state, city, service }) => ({
      path: `/epoxy-flooring/${state}/${city}/${service}/`,
      changefreq: 'monthly',
      priority: 0.6,
    })),
  },
  {
    name: 'guides',
    entries: GUIDE_PAGES.map(({ slug }) => ({
      path: `/guides/${slug}/`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: gitLastModified(`content/data/guides/${slug}.js`),
    })),
  },
  {
    name: 'colors',
    entries: COLOR_PAGES.map(({ slug }) => ({
      path: `/colors/${slug}/`,
      changefreq: 'monthly',
      priority: 0.5,
    })),
  },
  { name: 'pros', entries: PROS_PAGES },
  {
    name: 'best',
    entries: RANKING_PAGES.map((slug) => ({
      path: `/best/${slug}/`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: gitLastModified(`content/data/rankings/${slug}.js`),
    })),
  },
  {
    name: 'reviews',
    entries: REVIEW_PAGES.map((slug) => ({
      path: `/reviews/${slug}/`,
      changefreq: 'monthly',
      priority: 0.6,
      lastmod: gitLastModified(`content/data/reviews/${slug}.js`),
    })),
  },
  {
    name: 'compare',
    entries: [
      ...(HAS_COMPARE_HUB ? [{ path: '/compare/', changefreq: 'weekly', priority: 0.7, lastmod: gitLastModified('content/data/compare-hub.js') }] : []),
      ...COMPARE_PAGES.map((slug) => ({
        path: `/compare/${slug}/`,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: gitLastModified(`content/data/compare/${slug}.js`),
      })),
      ...(HAS_DIY_VS_PRO_PILLAR ? [{ path: '/compare/diy-kit-vs-professional-epoxy/', changefreq: 'weekly', priority: 0.7, lastmod: gitLastModified('content/data/diy-vs-pro-pillar.js') }] : []),
    ],
  },
  {
    name: 'diy',
    entries: [
      ...(HAS_DIY_HUB ? [{ path: '/diy/', changefreq: 'weekly', priority: 0.7, lastmod: gitLastModified('content/data/diy-hub.js') }] : []),
      ...DIY_GUIDE_PAGES.map((slug) => ({
        path: `/diy/${slug}/`,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: gitLastModified(`content/data/diy/${slug}.js`),
      })),
      ...SHOPPING_LIST_PAGES.map((slug) => ({
        path: `/diy/${slug}/`,
        changefreq: 'monthly',
        priority: 0.6,
        lastmod: gitLastModified(`content/data/shopping-lists/${slug}.js`),
      })),
    ],
  },
  {
    name: 'tools',
    entries: existsSync(join(CONTENT_DATA_DIR, 'tools', 'epoxy-coverage-calculator.js'))
      ? [{ path: '/tools/epoxy-coverage-calculator/', changefreq: 'monthly', priority: 0.6, lastmod: gitLastModified('content/data/tools/epoxy-coverage-calculator.js') }]
      : [],
  },
  {
    name: 'contractors',
    entries: [
      ...allStateSlugs().map((state) => ({ path: `/contractors/${state}/`, changefreq: 'weekly', priority: 0.6, lastmod: ENRICHED_LASTMOD })),
      ...METROS.map((m) => ({ path: `/contractors/${m.state_slug}/${m.slug}/`, changefreq: 'weekly', priority: 0.65, lastmod: ENRICHED_LASTMOD })),
      ...CONTRACTORS.map((c) => ({ path: `/contractors/${c.state_slug}/${c.slug}/`, changefreq: 'monthly', priority: 0.6, lastmod: ENRICHED_LASTMOD })),
    ],
  },
];

function urlEntry({ path, changefreq = 'monthly', priority = 0.5, lastmod }) {
  const lastmodTag = lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : '';
  return `  <url>\n    <loc>${SITE_URL}${path}</loc>${lastmodTag}\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
}

function buildUrlset(entries) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.map(urlEntry).join('\n')}\n</urlset>\n`;
}

function buildIndex(sectionNames) {
  const items = sectionNames
    .map((name) => `  <sitemap><loc>${SITE_URL}/sitemap-${name}.xml</loc></sitemap>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${items}\n</sitemapindex>\n`;
}

function run() {
  const nonEmpty = sections.filter((s) => s.entries.length > 0);
  let totalUrls = 0;

  if (nonEmpty.length <= 1) {
    const entries = nonEmpty[0]?.entries || [];
    writeFileSync(join(ROOT, 'sitemap.xml'), buildUrlset(entries));
    totalUrls = entries.length;
    console.log(`Wrote sitemap.xml with ${totalUrls} URL(s).`);
    return;
  }

  for (const s of nonEmpty) {
    writeFileSync(join(ROOT, `sitemap-${s.name}.xml`), buildUrlset(s.entries));
    totalUrls += s.entries.length;
  }
  writeFileSync(join(ROOT, 'sitemap.xml'), buildIndex(nonEmpty.map((s) => s.name)));
  console.log(`Wrote sitemap index + ${nonEmpty.length} child sitemap(s), ${totalUrls} URL(s) total.`);
}

run();
