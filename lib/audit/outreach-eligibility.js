// Some crawls land on a security-challenge/bot-block page instead of the
// real homepage (observed: SGCaptcha's /.well-known/sgcaptcha/ interstitial,
// a ClickCease block page) — the audit still produces a composite_score in
// that case, but it's scoring the wrong page entirely. Shared by every
// place an `audits` row gets inserted so the stored outreach_excluded_reason
// column stays consistent, rather than re-implementing this per script.
const BLOCKED_CRAWL_RE = /captcha|clickcease|\.well-known|challenge|cf_chl|recaptcha|access-denied/i;

/**
 * @param {{finalUrl?: string|null, siteUnreachable?: boolean}} result
 * @returns {'crawl_blocked' | 'unreachable' | null}
 */
export function outreachExcludedReason({ finalUrl, siteUnreachable }) {
  if (finalUrl && BLOCKED_CRAWL_RE.test(finalUrl)) return 'crawl_blocked';
  if (siteUnreachable) return 'unreachable';
  return null;
}
