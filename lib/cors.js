// Cross-origin allowlist for client-site demos that call EpoxyGrind's own
// APIs (chat, contact, leads, audit self-check) instead of standing up their
// own backend — the Mirrorball Epoxy build and the X by 2 consulting rebuild
// (each its own repo/hosting: mirrorball-epoxy and xby2-consulting on
// GitHub). Exact origins for the production aliases plus a prefix match for
// Vercel's per-deploy preview URLs (<project>-<hash>-<team>.vercel.app),
// since those hashes aren't predictable ahead of a deploy. Deliberately NOT a
// wildcard — this is a named allowlist of sites we've built, not "any origin
// may call this."
const ALLOWED_EXACT_ORIGINS = new Set([
  'https://mirrorball-epoxy.vercel.app',
  'https://www.mirrorballepoxy.com',
  'https://mirrorballepoxy.com',
  'https://xby2-consulting.vercel.app',
]);
const ALLOWED_ORIGIN_PREFIXES = ['https://mirrorball-epoxy-', 'https://xby2-consulting-'];

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_EXACT_ORIGINS.has(origin)) return true;
  return ALLOWED_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix) && origin.endsWith('.vercel.app'));
}

/**
 * Applies CORS headers for allowlisted cross-origin demo sites and short-
 * circuits an OPTIONS preflight. Same-origin requests (no Origin header, or
 * an origin the browser doesn't send for non-CORS requests) are unaffected —
 * this only ever adds permission, never removes access same-origin callers
 * already had.
 * @returns {boolean} true if the caller already sent the response (an
 *   OPTIONS preflight) and the handler should return immediately.
 */
export function applyCors(req, res) {
  const origin = req.headers.origin;
  if (isAllowedOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
