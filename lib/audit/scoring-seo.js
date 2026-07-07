const EPOXY_KEYWORDS = /epoxy|concrete|floor|coating|garage/i;

/**
 * Category 6 — SEO (12% weight). Point allocation (sums to 100): title tag
 * 20, meta description 15, single H1 15, alt coverage 15, LocalBusiness
 * schema 15, sitemap+robots 10, city/service nav links 10.
 * @param {object} crawl site-crawl.js's crawlSite() output
 * @param {{city?: string, state?: string}} contractor for keyword relevance check
 */
export function scoreSEO(crawl, contractor = {}) {
  let score = 0;
  const checks = [];
  const title = crawl.seo?.title || '';
  const desc = crawl.seo?.metaDescription || '';

  const titleHasKeyword = EPOXY_KEYWORDS.test(title) || (contractor.city && title.toLowerCase().includes(contractor.city.toLowerCase()));
  const titleOk = title.length >= 10 && title.length <= 60 && titleHasKeyword;
  if (titleOk) score += 20;
  else if (title.length > 0) score += 8;
  checks.push({
    label: 'Title tag',
    value: title ? `"${title.slice(0, 60)}"${title.length > 60 ? '…' : ''}` : 'Missing',
    verdict: titleOk ? 'Title is well-formed and relevant.' : title ? 'Title exists but is generic or the wrong length.' : 'No title tag at all.',
    // Never assert a specific city or service niche here: contractor.city
    // is Google-Places-sourced and can be flatly wrong (confirmed real case
    // — DB said "Houston" for a business whose own site titles itself
    // "Austin's Concrete Coating Expert"), and plenty of contractors do
    // more than epoxy (decorative concrete, sealers, stamped concrete,
    // etc.), so a hardcoded "Epoxy Flooring" niche is wrong just as often.
    fix: titleOk ? '' : 'Write a title like "[Your Main Service] in [Your City] | [Business Name]", 10-60 characters.',
    severity: title ? 2 : 5,
    passed: titleOk,
  });

  const descOk = desc.length >= 50 && desc.length <= 160;
  if (descOk) score += 15;
  checks.push({
    label: 'Meta description',
    value: desc ? `${desc.length} chars` : 'Missing',
    verdict: descOk ? 'Good length for a search snippet.' : desc ? `${desc.length} chars — outside the 50-160 sweet spot.` : 'No meta description — Google writes one for you (usually badly).',
    fix: descOk ? '' : 'Write a 50-160 character description mentioning your service and city.',
    severity: desc ? 2 : 4,
    passed: descOk,
  });

  const h1Ok = crawl.seo?.h1Count === 1;
  if (h1Ok) score += 15;
  checks.push({
    label: 'Single H1',
    value: `${crawl.seo?.h1Count ?? 0} found`,
    verdict: h1Ok ? 'Exactly one H1 — clean hierarchy.' : crawl.seo?.h1Count === 0 ? 'No H1 on the page.' : 'Multiple H1s — confuses search engines about the page topic.',
    fix: h1Ok ? '' : 'Use exactly one H1 per page for the main heading.',
    severity: 3,
    passed: h1Ok,
  });

  const altOk = crawl.imgAltCoveragePct >= 80;
  if (altOk) score += 15;
  else score += Math.round((crawl.imgAltCoveragePct / 80) * 15);
  checks.push({
    label: 'Image alt text coverage',
    value: `${crawl.imgAltCoveragePct}%`,
    verdict: altOk ? 'Most images have descriptive alt text.' : 'Many images are missing alt text — a missed SEO + accessibility signal.',
    fix: altOk ? '' : 'Add descriptive alt text to real content images (not decorative icons).',
    severity: 2,
    passed: altOk,
  });

  if (crawl.seo?.hasLocalBusinessSchema) score += 15;
  checks.push({
    label: 'LocalBusiness schema',
    value: crawl.seo?.hasLocalBusinessSchema ? 'Present' : 'Missing',
    verdict: crawl.seo?.hasLocalBusinessSchema ? 'Structured data helps Google understand this is a local business.' : 'No LocalBusiness schema — missing an easy local-SEO win.',
    fix: crawl.seo?.hasLocalBusinessSchema ? '' : 'Add LocalBusiness JSON-LD with name, address, phone, and service area.',
    severity: 3,
    passed: crawl.seo?.hasLocalBusinessSchema,
  });

  const sitemapRobotsPoints = (crawl.sitemapOk ? 5 : 0) + (crawl.robotsOk ? 5 : 0);
  score += sitemapRobotsPoints;
  checks.push({
    label: 'sitemap.xml + robots.txt',
    value: `sitemap ${crawl.sitemapOk ? 'OK' : 'missing'}, robots ${crawl.robotsOk ? 'OK' : 'missing'}`,
    verdict: sitemapRobotsPoints === 10 ? 'Both present.' : 'Missing one or both — makes it harder for Google to crawl the site fully.',
    fix: sitemapRobotsPoints === 10 ? '' : 'Add a sitemap.xml and robots.txt referencing it.',
    severity: 2,
    passed: sitemapRobotsPoints === 10,
  });

  const hasCityPages = crawl.cityServiceLinkCount > 0;
  if (hasCityPages) score += 10;
  checks.push({
    label: 'City/service landing pages',
    value: `${crawl.cityServiceLinkCount} found in nav`,
    verdict: hasCityPages ? 'Site has dedicated location/service pages — good for ranking multiple areas.' : 'No dedicated city or service pages found — single-page sites rank for one query at best.',
    fix: hasCityPages ? '' : 'Add pages for each suburb/service you actually cover.',
    severity: 2,
    passed: hasCityPages,
  });

  return { score: Math.round(Math.min(100, score)), checks };
}
