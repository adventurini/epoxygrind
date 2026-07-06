/**
 * Category 3 — Lead funnel & conversion (18% weight, "the money category").
 * Point allocation (sums to 100): CTA above fold 20, phone above fold 15,
 * click-to-call 15, lead form (existence + field-count quality) 15, chat
 * widget 10, response-expectation copy 10, trust signals up to 15 (3 each,
 * max 5 signals per master spec).
 *
 * Form depth/dead-end funnel-walk simulation from the spec is simplified
 * here to a single-page crawl (v1): we only see whether the form is on the
 * homepage itself, not whether it's one or two clicks deep on a subpage —
 * a real multi-page crawl is a natural v2 addition, not built yet.
 * @param {object} crawl site-crawl.js's crawlSite() output
 */
export function scoreFunnel(crawl) {
  let score = 0;
  const checks = [];

  if (crawl.ctaAboveFold) score += 20;
  checks.push({
    label: 'Primary CTA above the fold',
    value: crawl.ctaAboveFold ? 'Present' : 'Missing',
    verdict: crawl.ctaAboveFold ? 'A clear next action is visible immediately.' : 'No obvious call-to-action visible without scrolling.',
    fix: crawl.ctaAboveFold ? '' : 'Add an action-verb button ("Get a Free Quote") in the first screen.',
    severity: 5,
    passed: crawl.ctaAboveFold,
  });

  if (crawl.phoneAboveFold) score += 15;
  checks.push({
    label: 'Phone number above the fold',
    value: crawl.phoneAboveFold ? 'Visible' : 'Not visible',
    verdict: crawl.phoneAboveFold ? 'Phone number is visible immediately.' : 'Phone number is buried or missing from the first screen.',
    fix: crawl.phoneAboveFold ? '' : 'Put the phone number in the header, visible on every page.',
    severity: 4,
    passed: crawl.phoneAboveFold,
  });

  if (crawl.hasTelLink) score += 15;
  checks.push({
    label: 'Click-to-call',
    value: crawl.hasTelLink ? 'Present' : 'Missing',
    verdict: crawl.hasTelLink ? 'One tap dials the business on mobile.' : 'No tappable phone link for mobile visitors.',
    fix: crawl.hasTelLink ? '' : 'Wrap the phone number in <a href="tel:...">.',
    severity: 5,
    passed: crawl.hasTelLink,
  });

  let formPoints = 0;
  let formVerdict;
  let formFix = '';
  if (!crawl.form?.exists) {
    formVerdict = 'No lead form found on the homepage.';
    formFix = 'Add a short quote-request form above the fold.';
  } else {
    const n = crawl.form.fieldCount;
    if (n <= 4) {
      formPoints = 15;
      formVerdict = `Lead form has ${n} fields — short and easy to complete.`;
    } else if (n <= 7) {
      formPoints = 7.5;
      formVerdict = `Lead form has ${n} fields — longer than ideal.`;
      formFix = 'Cut to name, phone, email, and a project note — ask the rest on the call.';
    } else {
      formPoints = 0;
      formVerdict = `Lead form has ${n} fields — this form is scaring people away.`;
      formFix = 'Cut this down to 4 fields or fewer; every extra field loses submissions.';
    }
  }
  score += formPoints;
  checks.push({
    label: 'Lead form',
    value: crawl.form?.exists ? `${crawl.form.fieldCount} fields` : 'Not found',
    verdict: formVerdict,
    fix: formFix,
    severity: crawl.form?.exists ? (crawl.form.fieldCount > 7 ? 4 : 1) : 5,
    passed: crawl.form?.exists && crawl.form.fieldCount <= 7,
  });

  if (crawl.chatWidgetPresent) score += 10;
  checks.push({
    label: 'Chat widget',
    value: crawl.chatWidgetPresent ? 'Present' : 'Not found',
    verdict: crawl.chatWidgetPresent ? 'A chat widget is ready to catch visitors before they leave.' : 'No chat widget — this sets up the AI-answering pitch (Dominate tier).',
    fix: '',
    severity: 2,
    passed: crawl.chatWidgetPresent,
  });

  if (crawl.responseExpectationCopy) score += 10;
  checks.push({
    label: 'Response-time expectation set',
    value: crawl.responseExpectationCopy ? 'Present' : 'Missing',
    verdict: crawl.responseExpectationCopy ? 'Site tells visitors when to expect a reply.' : 'No copy telling visitors how fast you respond.',
    fix: crawl.responseExpectationCopy ? '' : 'Add a line like "We reply within one business day" near the form.',
    severity: 2,
    passed: crawl.responseExpectationCopy,
  });

  const trustCount = crawl.trustSignalHits?.length ?? 0;
  const trustPoints = Math.min(trustCount, 5) * 3;
  score += trustPoints;
  checks.push({
    label: 'Trust signals near the CTA',
    value: `${trustCount}/5 (${(crawl.trustSignalHits || []).join(', ') || 'none'})`,
    verdict: trustCount >= 3 ? 'Good trust signal coverage.' : 'Missing key trust signals homeowners look for before a $3k+ job.',
    fix: trustCount >= 3 ? '' : 'Add license #, insurance, review count, a guarantee, and a before/after gallery.',
    severity: trustCount === 0 ? 4 : 2,
    passed: trustCount >= 3,
  });

  return { score: Math.round(Math.min(100, score)), checks };
}
