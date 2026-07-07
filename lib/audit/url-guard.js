/**
 * Validates + normalizes a user-submitted URL for the public, unauthenticated
 * on-demand audit endpoint (api/audit/request.js). This is the one place in
 * the audit engine that runs the crawler/Lighthouse against an address we
 * didn't source ourselves (every other target comes from the curated Google
 * Places dataset) — so it's also the one place that needs to reject SSRF
 * targets (internal IPs, loopback, link-local/cloud-metadata, etc.).
 * @returns {{ok: true, url: string, hostname: string} | {ok: false, reason: string}}
 */
export function validateAndNormalizeUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) return { ok: false, reason: 'A website URL is required.' };

  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return { ok: false, reason: "That doesn't look like a valid website URL." };
  }

  if (!/^https?:$/.test(parsed.protocol)) {
    return { ok: false, reason: 'Only http:// and https:// URLs are supported.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  if (hostname === 'localhost' || hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    return { ok: false, reason: "That URL isn't reachable from the public internet." };
  }
  if (!hostname.includes('.')) {
    return { ok: false, reason: "That doesn't look like a valid website URL." };
  }

  // Reject IP-literal hosts in private/loopback/link-local/CGNAT ranges —
  // the classic SSRF targets (including the cloud-metadata endpoint at
  // 169.254.169.254). A real contractor's public site is never an IP
  // literal, so this costs nothing in false positives.
  const ipMatch = hostname.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipMatch) {
    const [a, b] = ipMatch.slice(1).map(Number);
    const isPrivate =
      a === 10 ||
      a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a === 0;
    if (isPrivate) return { ok: false, reason: "That URL isn't reachable from the public internet." };
  }
  if (hostname === '::1' || hostname.includes('[')) {
    return { ok: false, reason: "That doesn't look like a valid website URL." };
  }

  parsed.hash = '';
  return { ok: true, url: parsed.toString(), hostname };
}
