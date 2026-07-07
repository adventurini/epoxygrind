import { runLighthouse } from './lighthouse-runner.js';
import { crawlSite } from './site-crawl.js';
import { crawlSiteStructure } from './site-structure.js';
import { captureDesktopScreenshot } from './screenshots.js';
import { scorePerformance } from './scoring-performance.js';
import { scoreMobile } from './scoring-mobile.js';
import { scoreFunnel } from './scoring-funnel.js';
import { scoreSEO } from './scoring-seo.js';
import { scoreSecurity } from './scoring-security.js';
import { scoreLocalPresence } from './scoring-local.js';
import { scoreStructure } from './scoring-structure.js';
import { scoreDesignUX } from './vision-design.js';
import { scoreImageQuality } from './vision-images.js';
import { gradeForScore } from './grades.js';
import { getContractorHero } from '../contractor-images.js';

/** Category id -> weight (sums to 100) and which master-spec tier a failed
 * check in that category maps to, for the reveal-page pitch (spec §Phase 2:
 * "Each finding maps to a tier"). Trimmed slightly across the board to make
 * room for siteStructure (a multi-page crawl added after the initial batch
 * — see lib/audit/site-structure.js) without losing the "sums to 100" invariant. */
const CATEGORIES = {
  performance: { weight: 16, tier: 'launch' },
  mobile: { weight: 14, tier: 'launch' },
  funnel: { weight: 16, tier: 'launch' },
  designUx: { weight: 14, tier: 'launch' },
  imageQuality: { weight: 9, tier: 'launch' },
  seo: { weight: 10, tier: 'launch' },
  localPresence: { weight: 8, tier: 'own_your_market' },
  security: { weight: 3, tier: 'launch' },
  siteStructure: { weight: 10, tier: 'launch' },
};
// Funnel checks that specifically signal a Dominate-tier gap (chat/response
// automation), rather than the base Launch-tier "you need a website" gap.
const DOMINATE_CHECK_LABELS = new Set(['Chat widget', 'Response-time expectation set']);

function tierForCheck(categoryId, label) {
  if (categoryId === 'funnel' && DOMINATE_CHECK_LABELS.has(label)) return 'dominate';
  if (categoryId === 'localPresence' && label !== 'NAP consistency (phone)') return 'own_your_market';
  return CATEGORIES[categoryId].tier;
}

// Some checks in different categories fix the exact same underlying
// problem from a different angle — e.g. funnel's "Click-to-call" and
// mobile's "Click-to-call link" both just mean "wrap the phone number in
// a tel: link". A site failing both showed two near-identical entries in
// the top-5 findings, which reads as repetitive rather than as two
// distinct problems. Only the higher-ranked one of each group counts
// toward the top-5; the lower one still shows in the full per-category
// breakdown further down the audit page, just not duplicated up top.
const DUPLICATE_FINDING_GROUPS = [
  ['Click-to-call', 'Click-to-call link'],
];

function duplicateGroupKey(label) {
  const group = DUPLICATE_FINDING_GROUPS.find((g) => g.includes(label));
  return group ? group[0] : label;
}

/**
 * Composite score + grade + top findings from a set of category results.
 * Shared by runAudit() and scripts/enrich-site-structure.js (which merges a
 * new category into an already-scored row and needs to recompute the same
 * way, rather than drifting out of sync with a second copy of this logic).
 * @param {object} categoryResults {categoryId: {score, checks}}
 */
export function composeResult(categoryResults) {
  let weightedSum = 0;
  let weightTotal = 0;
  for (const [id, { weight }] of Object.entries(CATEGORIES)) {
    const s = categoryResults[id]?.score;
    if (typeof s === 'number') {
      weightedSum += s * weight;
      weightTotal += weight;
    }
  }
  const compositeScore = weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;

  const allFindings = [];
  for (const [id, { weight }] of Object.entries(CATEGORIES)) {
    for (const check of categoryResults[id]?.checks || []) {
      if (check.passed) continue;
      allFindings.push({
        category: id,
        label: check.label,
        verdict: check.verdict,
        fix: check.fix,
        severity: check.severity,
        rank: weight * check.severity,
        tier: tierForCheck(id, check.label),
      });
    }
  }
  const seenGroups = new Set();
  const topFindings = [];
  for (const finding of allFindings.sort((a, b) => b.rank - a.rank)) {
    const key = duplicateGroupKey(finding.label);
    if (seenGroups.has(key)) continue;
    seenGroups.add(key);
    topFindings.push(finding);
    if (topFindings.length === 5) break;
  }

  return { compositeScore, grade: gradeForScore(compositeScore), topFindings };
}

/**
 * Full audit for one contractor. `localMedianReviewCount` is computed once
 * per batch (see scripts/run-audits.js) and passed in — recomputing a
 * median per-contractor would mean re-scanning the whole contractor list
 * thousands of times.
 * @param {object} contractor enriched contractor record
 * @param {number} localMedianReviewCount
 */
export async function runAudit(contractor, localMedianReviewCount) {
  const website = contractor.website;
  if (!website) {
    return { hasWebsite: false, compositeScore: null, grade: gradeForScore(null) };
  }

  // These 4 calls each launch their own Chromium instance. Fully parallel
  // is fine locally (scripts/run-audits.js, plenty of RAM), but running 4
  // simultaneous browser processes inside a Vercel serverless function's
  // tighter memory ceiling produced real crashes (Chromium's GPU/shared-
  // memory buffer allocation failing) on real-world sites during testing —
  // confirmed via the actual crash message, not a guess: "ContextResult::
  // kFatalFailure: CommandBufferHelper::AllocateRingBuffer() failed". Halve
  // the peak concurrent browser count on Vercel specifically; local/batch
  // behavior (and its tuned throughput) is unaffected.
  let lhResult, crawl, desktopScreenshot, structure;
  const runners = [
    () => runLighthouse(website).catch((err) => ({ ok: false, error: err.message })),
    () => crawlSite(website, { knownPhones: contractor.phones || [] }).catch((err) => ({ ok: false, error: err.message })),
    () => captureDesktopScreenshot(website).catch(() => null),
    () => crawlSiteStructure(website, { knownPhones: contractor.phones || [] }).catch((err) => ({ ok: false, error: err.message })),
  ];
  if (process.env.VERCEL) {
    // Two fully sequential waves, not just re-paired — pairing without a
    // hard wave boundary still let a 3rd browser start before the 1st
    // finished. This guarantees at most 2 Chromium processes alive at once.
    [lhResult, crawl] = await Promise.all([runners[0](), runners[1]()]);
    [desktopScreenshot, structure] = await Promise.all([runners[2](), runners[3]()]);
  } else {
    [lhResult, crawl, desktopScreenshot, structure] = await Promise.all(runners.map((r) => r()));
  }

  if (!crawl.ok) {
    return { hasWebsite: true, siteUnreachable: true, error: crawl.error, compositeScore: null, grade: gradeForScore(null) };
  }

  const hero = getContractorHero(contractor.state_slug, contractor.slug);

  const categoryResults = {
    performance: lhResult.ok ? scorePerformance(lhResult.lhr) : { score: null, checks: [], error: lhResult.error },
    mobile: scoreMobile(crawl),
    funnel: scoreFunnel(crawl),
    seo: scoreSEO(crawl, contractor),
    security: scoreSecurity(crawl),
    localPresence: scoreLocalPresence(contractor, hero, localMedianReviewCount, crawl),
    siteStructure: scoreStructure(structure),
  };

  const [designUx, imageQuality] = await Promise.all([
    scoreDesignUX(desktopScreenshot, crawl.mobileScreenshot),
    scoreImageQuality(crawl.images),
  ]);
  categoryResults.designUx = designUx;
  categoryResults.imageQuality = imageQuality;

  // Composite: weighted mean of categories that actually produced a score
  // (a Lighthouse or AI-vision failure shouldn't silently zero the whole
  // audit — reweight across whatever did score).
  const { compositeScore, grade, topFindings } = composeResult(categoryResults);

  // Raw per-page map, kept separate from the scored category above — this is
  // what a future site-rebuild/SEO pass reads (the full list of a contractor's
  // real URLs), not something we want folded into the scoring JSON.
  const siteStructureData = structure?.ok
    ? {
        pageCount: structure.pageCount,
        cappedAtMax: structure.cappedAtMax,
        urlList: structure.urlList,
        brokenLinks: structure.brokenLinks,
        pages: structure.pages.map((p) => ({
          url: p.url,
          statusCode: p.statusCode,
          title: p.title,
          metaDescription: p.metaDescription,
          og: p.og,
          wordCount: p.wordCount,
        })),
      }
    : null;

  return {
    hasWebsite: true,
    siteUnreachable: false,
    finalUrl: crawl.finalUrl,
    compositeScore,
    grade,
    categoryScores: categoryResults,
    topFindings,
    siteStructureData,
    screenshots: { desktop: desktopScreenshot, mobile: crawl.mobileScreenshot },
  };
}

export { CATEGORIES };
