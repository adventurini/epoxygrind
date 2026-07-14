import { runAudit } from '../../lib/audit/index.js';
import { applyCors, isAllowedOrigin } from '../../lib/cors.js';

// maxDuration/memory/includeFiles for this function are set in vercel.json
// (includeFiles specifically is vercel.json-only — it's not respected from
// an in-file `export const config`), matching api/audit/request.js and
// api/admin/recrawl.js, the other two functions that run the same
// Lighthouse-dependent audit engine.

/**
 * GET /api/audit/self-check?url=https://mirrorball-epoxy.vercel.app/ — runs
 * a real, live audit (same engine as lib/audit/index.js's runAudit, used
 * for every contractor outreach audit) on demand, for a client site's own
 * private, unlinked /audit/ page to self-check its score. Deliberately
 * NOT persisted to the contractors/audits tables — this is a self-check
 * tool, not part of the outreach pipeline.
 *
 * Real cost/abuse surface (Lighthouse + AI vision calls per request), so
 * this is locked down two ways, not just CORS headers (which only stop
 * browsers, not a direct server-to-server call): the calling origin must
 * be on the same named allowlist as every other client-site endpoint, AND
 * the URL being audited must be that exact same origin — a site can only
 * ever self-audit itself, never use this as a free-audit-anyone tool.
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const origin = req.headers.origin;
  if (!isAllowedOrigin(origin)) {
    return res.status(403).json({ error: 'Not authorized.' });
  }

  const url = String(req.query?.url || '').trim();
  let target;
  try {
    target = new URL(url);
  } catch {
    return res.status(400).json({ error: 'A valid url is required.' });
  }

  let originHost;
  try {
    originHost = new URL(origin).hostname;
  } catch {
    return res.status(403).json({ error: 'Not authorized.' });
  }
  if (target.hostname !== originHost) {
    return res.status(403).json({ error: 'Can only self-audit your own origin.' });
  }

  try {
    const result = await runAudit({ website: target.toString(), phones: [] }, 0);
    return res.status(200).json(result);
  } catch (err) {
    console.error('Self-check audit failed:', err.message);
    return res.status(500).json({ error: err.message || 'Audit failed.' });
  }
}
