/**
 * Category 8 — Security & technical (3% weight, lowest-weighted but cheap
 * to check). Point allocation (sums to 100): SSL 35, no mixed content 20,
 * not a builder subdomain 25, console errors 10, favicon 10.
 * @param {object} crawl site-crawl.js's crawlSite() output
 */
export function scoreSecurity(crawl) {
  let score = 0;
  const checks = [];

  if (crawl.isHttps) score += 35;
  checks.push({
    label: 'Valid SSL (HTTPS)',
    value: crawl.isHttps ? 'HTTPS' : 'HTTP only',
    verdict: crawl.isHttps ? 'Site loads securely.' : 'Site isn\'t on HTTPS — browsers flag this as "Not Secure."',
    fix: crawl.isHttps ? '' : 'Install an SSL certificate (usually free via the host) and force HTTPS.',
    severity: 5,
    passed: crawl.isHttps,
  });

  const noMixed = crawl.mixedContentCount === 0;
  if (noMixed) score += 20;
  checks.push({
    label: 'No mixed content',
    value: noMixed ? 'Clean' : `${crawl.mixedContentCount} insecure request(s)`,
    verdict: noMixed ? 'No insecure resources loading on a secure page.' : 'Some resources load over plain HTTP on a secure page — browsers may block them.',
    fix: noMixed ? '' : 'Update hardcoded http:// asset URLs to https://.',
    severity: 3,
    passed: noMixed,
  });

  const notBuilder = !crawl.isBuilderSubdomain;
  if (notBuilder) score += 25;
  checks.push({
    label: 'Custom domain (not a builder subdomain)',
    value: notBuilder ? crawl.host : crawl.host,
    verdict: notBuilder ? 'Running on a real, owned domain.' : `Still on a free builder subdomain (${crawl.host}) — reads as an unfinished business to homeowners.`,
    fix: notBuilder ? '' : 'Buy a real domain and point it at the site.',
    severity: 4,
    passed: notBuilder,
  });

  const errCount = crawl.consoleErrorCount ?? 0;
  const errOk = errCount === 0;
  score += errOk ? 10 : errCount <= 3 ? 5 : 0;
  checks.push({
    label: 'Console errors on load',
    value: `${errCount}`,
    verdict: errOk ? 'Clean page load, no JS errors.' : `${errCount} console error(s) on load — a sign of a broken or neglected site.`,
    fix: errOk ? '' : 'Open browser dev tools and fix the reported script errors.',
    severity: errCount > 3 ? 3 : 1,
    passed: errOk,
  });

  if (crawl.hasFavicon) score += 10;
  checks.push({
    label: 'Favicon present',
    value: crawl.hasFavicon ? 'Present' : 'Missing',
    verdict: crawl.hasFavicon ? 'Browser tab shows a real icon.' : 'No favicon — a small but visible "unfinished" signal.',
    fix: crawl.hasFavicon ? '' : 'Add a favicon.ico / icon link tag.',
    severity: 1,
    passed: crawl.hasFavicon,
  });

  return { score: Math.round(Math.min(100, score)), checks };
}
