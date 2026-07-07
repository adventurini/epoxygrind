/**
 * Category 1 — Performance (18% weight). Master spec: "Lighthouse
 * performance score (primary), LCP in seconds, total page weight. LCP > 4s
 * caps the category at 60."
 * @param {object} lhr Lighthouse result (mobile)
 */
export function scorePerformance(lhr) {
  // A null performance score means Lighthouse's own navigation failed
  // (e.g. the target returned a real HTTP 500 to Lighthouse's request,
  // confirmed on a real site: ERRORED_DOCUMENT_REQUEST) — genuinely
  // different from "we measured it and it's terrible". The old `?? 0`
  // fallback here silently turned "couldn't measure this" into a fake
  // 0/100 (the worst possible score), unlike every other category, which
  // already excludes itself from the composite via an `error` field when
  // its underlying signal is missing.
  if (lhr.categories.performance?.score == null) {
    return { score: null, checks: [], error: 'Lighthouse could not load the page (the site may be blocking automated requests or returned an error).' };
  }
  const perfScore = Math.round(lhr.categories.performance.score * 100);
  const lcpSeconds = (lhr.audits['largest-contentful-paint']?.numericValue ?? 0) / 1000;
  const pageWeightBytes = lhr.audits['total-byte-weight']?.numericValue ?? 0;
  const pageWeightKb = Math.round(pageWeightBytes / 1024);

  let score = perfScore;
  const lcpCapped = lcpSeconds > 4;
  if (lcpCapped) score = Math.min(score, 60);

  const checks = [
    {
      label: 'Lighthouse performance score',
      value: `${perfScore}/100`,
      verdict: perfScore >= 90 ? 'Fast — no real concern.' : perfScore >= 50 ? 'Middling load speed.' : 'Slow — visitors bounce before it loads.',
      fix: perfScore >= 90 ? '' : 'Compress images, defer non-critical scripts, and cut unused CSS/JS.',
      severity: perfScore >= 90 ? 1 : perfScore >= 50 ? 3 : 5,
      passed: perfScore >= 50,
    },
    {
      label: 'Largest Contentful Paint',
      value: `${lcpSeconds.toFixed(1)}s`,
      verdict: `Your site takes ${lcpSeconds.toFixed(1)}s to show anything.`,
      fix: lcpCapped ? 'The hero image or main content is loading too slowly — compress/preload it.' : '',
      severity: lcpSeconds > 4 ? 5 : lcpSeconds > 2.5 ? 3 : 1,
      passed: lcpSeconds <= 4,
    },
    {
      label: 'Total page weight',
      value: `${pageWeightKb.toLocaleString()} KB`,
      verdict: pageWeightKb > 3000 ? 'Heavy page — likely uncompressed images.' : 'Reasonable page weight.',
      fix: pageWeightKb > 3000 ? 'Compress and lazy-load images; this is almost always the culprit.' : '',
      severity: pageWeightKb > 5000 ? 4 : pageWeightKb > 3000 ? 2 : 1,
      passed: pageWeightKb <= 3000,
    },
  ];

  return { score, checks, raw: { perfScore, lcpSeconds, pageWeightKb, lcpCapped } };
}
