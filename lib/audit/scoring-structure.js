/**
 * Category 9 — Site structure (lightweight multi-page crawl, homepage-only
 * categories elsewhere still do the heavy Lighthouse/AI-vision work). Point
 * allocation (sums to 100): broken links 25, title health across pages 15,
 * meta description health across pages 15, Open Graph coverage 10, NAP
 * consistency across pages 15, CTA/contact presence across pages 15, image
 * alt coverage sitewide 5.
 * @param {object} structure lib/audit/site-structure.js's crawlSiteStructure() output
 */
export function scoreStructure(structure) {
  if (!structure?.ok || !structure.pageCount) {
    return { score: null, checks: [], error: structure?.error || 'no pages crawled' };
  }

  const { pageCount, brokenLinks, duplicateTitles, duplicateMetaDescriptions, missingTitleUrls, missingMetaUrls, missingOgUrls, napConsistencyPct, pages } = structure;
  let score = 0;
  const checks = [];

  const brokenCount = brokenLinks.length;
  const brokenOk = brokenCount === 0;
  score += brokenOk ? 25 : Math.max(0, 25 - brokenCount * 5);
  checks.push({
    label: 'Broken links',
    value: brokenOk ? 'None found' : `${brokenCount} found`,
    verdict: brokenOk
      ? `Checked ${pageCount} pages, no broken internal links.`
      : `${brokenCount} broken link${brokenCount === 1 ? '' : 's'} across ${pageCount} pages checked — dead ends homeowners hit mid-browse.`,
    fix: brokenOk ? '' : 'Fix or remove the broken links (' + brokenLinks.slice(0, 3).map((b) => b.url).join(', ') + (brokenLinks.length > 3 ? ', …' : '') + ').',
    severity: 5,
    passed: brokenOk,
  });

  const titleIssues = duplicateTitles.length + missingTitleUrls.length;
  const titleOk = titleIssues === 0;
  score += titleOk ? 15 : Math.max(0, 15 - Math.round((titleIssues / pageCount) * 15) - 3);
  checks.push({
    label: 'Unique title tags across pages',
    value: titleOk ? `All ${pageCount} pages unique` : `${duplicateTitles.length} duplicate group(s), ${missingTitleUrls.length} missing`,
    verdict: titleOk
      ? 'Every crawled page has its own title tag.'
      : 'Multiple pages share (or are missing) a title tag — Google can\'t tell them apart and may drop one from the index entirely.',
    fix: titleOk ? '' : 'Give every page its own specific, keyword-relevant title.',
    severity: 3,
    passed: titleOk,
  });

  const metaIssues = duplicateMetaDescriptions.length + missingMetaUrls.length;
  const metaOk = metaIssues === 0;
  score += metaOk ? 15 : Math.max(0, 15 - Math.round((metaIssues / pageCount) * 15) - 3);
  checks.push({
    label: 'Unique meta descriptions across pages',
    value: metaOk ? `All ${pageCount} pages unique` : `${duplicateMetaDescriptions.length} duplicate group(s), ${missingMetaUrls.length} missing`,
    verdict: metaOk
      ? 'Every crawled page has its own meta description.'
      : 'Several pages share or are missing a meta description — Google writes its own (usually badly) for those.',
    fix: metaOk ? '' : 'Write a unique 50-160 character description per page.',
    severity: 2,
    passed: metaOk,
  });

  const ogCoveragePct = Math.round(((pageCount - missingOgUrls.length) / pageCount) * 100);
  const ogOk = ogCoveragePct >= 80;
  score += ogOk ? 10 : Math.round((ogCoveragePct / 80) * 10);
  checks.push({
    label: 'Open Graph tags across pages',
    value: `${ogCoveragePct}% of pages`,
    verdict: ogOk
      ? 'Most pages have Open Graph tags — links preview cleanly when shared.'
      : 'Many pages are missing Open Graph tags — shared links (Facebook, texts, iMessage previews) show a blank or generic card.',
    fix: ogOk ? '' : 'Add og:title, og:description, and og:image to every page template.',
    severity: 2,
    passed: ogOk,
  });

  const napOk = napConsistencyPct === null || napConsistencyPct >= 80;
  score += napConsistencyPct === null ? 15 : napOk ? 15 : Math.round((napConsistencyPct / 80) * 15);
  checks.push({
    label: 'Phone number consistency across pages',
    value: napConsistencyPct === null ? 'N/A (no known phone to check)' : `${napConsistencyPct}% of relevant pages match`,
    verdict: napConsistencyPct === null
      ? 'No listing phone number on file to cross-check.'
      : napOk
        ? 'Phone number is consistent across the site.'
        : 'Phone number is inconsistent across pages — confuses both Google and customers about which number is real.',
    fix: napOk || napConsistencyPct === null ? '' : 'Standardize on one phone number sitewide.',
    severity: 3,
    passed: napOk,
  });

  const ctaPages = pages.filter((p) => p.hasTelLink || p.hasForm || p.ctaHit).length;
  const ctaCoveragePct = Math.round((ctaPages / pageCount) * 100);
  const ctaOk = ctaCoveragePct >= 50;
  score += ctaOk ? 15 : Math.round((ctaCoveragePct / 50) * 15);
  checks.push({
    label: 'Contact/CTA presence across pages',
    value: `${ctaCoveragePct}% of pages have a phone, form, or CTA`,
    verdict: ctaOk
      ? 'Most pages give a visitor a way to reach out, not just the homepage.'
      : 'Contact options only live on a few pages — a visitor who lands on a service or gallery page can get stuck with no way to reach out.',
    fix: ctaOk ? '' : 'Put a phone number or lead form on every page, not just the homepage.',
    severity: 3,
    passed: ctaOk,
  });

  const totalImages = pages.reduce((sum, p) => sum + p.imageCount, 0);
  const missingAlt = pages.reduce((sum, p) => sum + p.missingAltCount, 0);
  const altPct = totalImages ? Math.round(((totalImages - missingAlt) / totalImages) * 100) : 100;
  const altOk = altPct >= 80;
  score += altOk ? 5 : Math.round((altPct / 80) * 5);
  checks.push({
    label: 'Image alt text coverage sitewide',
    value: `${altPct}% across ${totalImages} images`,
    verdict: altOk ? 'Alt text coverage holds up across the whole site.' : 'Alt text coverage drops off past the homepage.',
    fix: altOk ? '' : 'Add descriptive alt text to real content images sitewide, not just the homepage.',
    severity: 1,
    passed: altOk,
  });

  return { score: Math.round(Math.min(100, score)), checks };
}
