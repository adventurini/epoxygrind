/**
 * Category 2 — Mobile experience (15% weight). Master spec: "Score: start
 * 100, subtract per failure (viewport -30, tap targets -20, no tel: -25,
 * no reachable CTA -15, h-scroll -10)."
 * @param {object} crawl site-crawl.js's crawlSite() output
 */
export function scoreMobile(crawl) {
  let score = 100;
  const checks = [];

  const viewportOk = crawl.hasViewportMeta;
  if (!viewportOk) score -= 30;
  checks.push({
    label: 'Viewport meta tag',
    value: viewportOk ? 'Present' : 'Missing',
    verdict: viewportOk ? 'Page scales correctly on phones.' : "No viewport tag — the page won't scale to phone screens at all.",
    fix: viewportOk ? '' : 'Add <meta name="viewport" content="width=device-width, initial-scale=1">.',
    severity: 5,
    passed: viewportOk,
  });

  const tapPct = crawl.tapTargets?.total ? crawl.tapTargets.tooSmall / crawl.tapTargets.total : 0;
  const tapOk = tapPct <= 0.2;
  if (!tapOk) score -= 20;
  checks.push({
    label: 'Tap target size',
    value: crawl.tapTargets?.total ? `${crawl.tapTargets.tooSmall}/${crawl.tapTargets.total} under 44px` : 'N/A',
    verdict: tapOk ? 'Buttons and links are easy to tap.' : 'Too many buttons/links are smaller than a comfortable thumb tap.',
    fix: tapOk ? '' : 'Increase padding on nav links and buttons to at least 44x44px.',
    severity: 3,
    passed: tapOk,
  });

  const telOk = crawl.hasTelLink;
  if (!telOk) score -= 25;
  checks.push({
    label: 'Click-to-call link',
    value: telOk ? 'Present' : 'Missing',
    verdict: telOk ? 'Phone number is tappable on mobile.' : 'No tel: link — mobile visitors have to manually dial.',
    fix: telOk ? '' : 'Wrap the phone number in <a href="tel:...">.',
    severity: 5,
    passed: telOk,
  });

  const ctaOk = crawl.reachableCtaAfterScroll;
  if (!ctaOk) score -= 15;
  checks.push({
    label: 'CTA reachable while scrolling',
    value: ctaOk ? 'Reachable' : 'Not found after scroll',
    verdict: ctaOk ? 'A call-to-action stays reachable as the visitor scrolls.' : 'No call-to-action visible partway down the page — easy to lose the visitor.',
    fix: ctaOk ? '' : 'Add a sticky header/footer CTA bar, or repeat the CTA further down the page.',
    severity: 3,
    passed: ctaOk,
  });

  const scrollOk = !crawl.hasHorizontalScroll;
  if (!scrollOk) score -= 10;
  checks.push({
    label: 'No horizontal scroll',
    value: scrollOk ? 'None' : 'Detected',
    verdict: scrollOk ? 'Page fits the screen width.' : 'Page overflows horizontally on a phone screen — looks broken.',
    fix: scrollOk ? '' : 'Find the element wider than the viewport (often a fixed-width table or image) and constrain it.',
    severity: 2,
    passed: scrollOk,
  });

  return { score: Math.max(0, score), checks };
}
