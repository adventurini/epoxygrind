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
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { METROS, allStateSlugs } from '../lib/metros.js';

// TODO: switch to https://epoxygrind.com once the custom domain is
// connected in Vercel (Supabase auth is already configured for it, but no
// domain is registered on the Vercel project yet as of this writing).
const SITE_URL = 'https://epoxygrind.vercel.app';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CONTENT_DATA_DIR = join(ROOT, 'content', 'data');

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
  { path: '/', changefreq: 'weekly', priority: 1.0 },
  { path: '/services/', changefreq: 'weekly', priority: 0.9 },
  { path: '/epoxy-flooring/', changefreq: 'weekly', priority: 0.8 },
];

// ── DIY & Product Content spec (spec_2) — auto-discovered from content/data/ ─
const RANKING_PAGES = listSlugs('rankings');
const REVIEW_PAGES = listSlugs('reviews');
const COMPARE_PAGES = listSlugs('compare');
const DIY_GUIDE_PAGES = listSlugs('diy');
const SHOPPING_LIST_PAGES = listSlugs('shopping-lists');
const HAS_DIY_HUB = existsSync(join(CONTENT_DATA_DIR, 'diy-hub.js'));

// ── Master SEO spec (spec_4) local pages — from content/data/metros.json ─
// State rollups: all 51. City hubs: every metro (331) — an explicit owner
// decision to skip the spec's phased Tier 1 → GSC-checkpoint → Tier 2 gate.
const STATE_PAGES = allStateSlugs().map((state) => ({ state }));
const CITY_PAGES = METROS.map((m) => ({ state: m.state_slug, city: m.slug }));

// ── Spec §1 sections, not built yet — populate as each ships ────────────
/** @type {{ state: string, city: string }[]} */
const DIRECTORY_PAGES = [];
/** @type {{ state: string, city: string, service: string }[]} */
const SERVICE_PAGES = [];
/** @type {{ slug: string }[]} */
const GUIDE_PAGES = [];
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
    })),
  },
  {
    name: 'cities',
    entries: CITY_PAGES.map(({ state, city }) => ({
      path: `/epoxy-flooring/${state}/${city}/`,
      changefreq: 'weekly',
      priority: 0.7,
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
    entries: RANKING_PAGES.map((slug) => ({ path: `/best/${slug}/`, changefreq: 'monthly', priority: 0.6 })),
  },
  {
    name: 'reviews',
    entries: REVIEW_PAGES.map((slug) => ({ path: `/reviews/${slug}/`, changefreq: 'monthly', priority: 0.6 })),
  },
  {
    name: 'compare',
    entries: COMPARE_PAGES.map((slug) => ({ path: `/compare/${slug}/`, changefreq: 'monthly', priority: 0.6 })),
  },
  {
    name: 'diy',
    entries: [
      ...(HAS_DIY_HUB ? [{ path: '/diy/', changefreq: 'weekly', priority: 0.7 }] : []),
      ...DIY_GUIDE_PAGES.map((slug) => ({ path: `/diy/${slug}/`, changefreq: 'monthly', priority: 0.6 })),
      ...SHOPPING_LIST_PAGES.map((slug) => ({ path: `/diy/${slug}/`, changefreq: 'monthly', priority: 0.6 })),
    ],
  },
  // Reserved for /tools/epoxy-coverage-calculator once the interactive
  // calculator ships (spec_2 §4 Type 5) — empty until then.
  { name: 'tools', entries: [] },
];

function urlEntry({ path, changefreq = 'monthly', priority = 0.5 }) {
  return `  <url>\n    <loc>${SITE_URL}${path}</loc>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority.toFixed(1)}</priority>\n  </url>`;
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
