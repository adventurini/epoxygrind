import { isSupabaseConfigured, getSupabase } from '../../lib/supabase.js';
import { validateAndNormalizeUrl } from '../../lib/audit/url-guard.js';
import { outreachExcludedReason } from '../../lib/audit/outreach-eligibility.js';

function slugify(name) {
  return String(name || '').toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'listing';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EXISTING_AUDIT_FRESH_DAYS = 90;
const RATE_LIMIT_WINDOW_HOURS = 24;
const RATE_LIMIT_MAX_PER_EMAIL = 3;
const AUDIT_TIMEOUT_MS = 150_000;

function sameHost(urlString, hostname) {
  try {
    return new URL(urlString).hostname.toLowerCase().replace(/^www\./, '') === hostname.replace(/^www\./, '');
  } catch {
    return false;
  }
}

/**
 * POST /api/audit/request { site, email } — public, unauthenticated.
 * Powers the /audit/ form: reuses a fresh existing audit for the same
 * domain if one exists, otherwise runs a real audit on demand (synchronous
 * — the batch engine's own per-target timeout is 120s, so this is well
 * within a single serverless invocation) and redirects to the same
 * /audit-report/{token} share page either way.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  const check = validateAndNormalizeUrl(req.body?.site);
  if (!check.ok) return res.status(400).json({ error: check.reason });
  const { url: normalizedUrl, hostname } = check;

  const supabase = getSupabase();

  try {
    // Rate limit by email — this endpoint runs real Lighthouse + AI-vision
    // work per request, so it's a real cost/abuse surface being public.
    const since = new Date(Date.now() - RATE_LIMIT_WINDOW_HOURS * 3600 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('contractors')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'self_serve')
      .eq('contact_email', email)
      .gte('created_at', since);
    if ((recentCount || 0) >= RATE_LIMIT_MAX_PER_EMAIL) {
      return res.status(429).json({ error: "You've hit the free audit limit for today — try again tomorrow, or reach out directly." });
    }

    // Look for a real, already-audited contractor at this domain first —
    // covers both our directory contractors and anyone previously self-served.
    const { data: candidates } = await supabase
      .from('contractors')
      .select('id, name, website')
      .ilike('website', `%${hostname}%`)
      .limit(10);
    const matchedContractor = (candidates || []).find((c) => c.website && sameHost(c.website, hostname));

    if (matchedContractor) {
      const freshSince = new Date(Date.now() - EXISTING_AUDIT_FRESH_DAYS * 24 * 3600 * 1000).toISOString();
      const { data: existingAudit } = await supabase
        .from('audits')
        .select('public_token, composite_score, audited_at')
        .eq('contractor_id', matchedContractor.id)
        .not('composite_score', 'is', null)
        .gte('audited_at', freshSince)
        .order('audited_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingAudit) {
        return res.status(200).json({ redirect: `/audit-report/${slugify(matchedContractor.name)}/${existingAudit.public_token}` });
      }
    }

    // No fresh existing audit — reuse or create a lightweight contractor
    // row for this domain (status: 'self_serve' keeps it out of the public
    // directory build, which reads a separate static enriched.json file
    // and requires phones/service_areas/google reviews we don't have here).
    let contractorId = matchedContractor?.id;
    if (!contractorId) {
      const { data: existingSelfServe } = await supabase
        .from('contractors')
        .select('id, website')
        .eq('status', 'self_serve')
        .ilike('website', `%${hostname}%`)
        .limit(10);
      contractorId = (existingSelfServe || []).find((c) => sameHost(c.website, hostname))?.id;
    }
    if (!contractorId) {
      const { data: created, error: createErr } = await supabase
        .from('contractors')
        .insert({ name: hostname, website: normalizedUrl, status: 'self_serve', contact_email: email })
        .select('id')
        .single();
      if (createErr) throw createErr;
      contractorId = created.id;
    }

    const { runAudit } = await import('../../lib/audit/index.js');
    let result;
    try {
      result = await Promise.race([
        runAudit({ website: normalizedUrl, phones: [] }, 0),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Audit timed out')), AUDIT_TIMEOUT_MS)),
      ]);
    } catch (err) {
      result = { hasWebsite: true, siteUnreachable: true, error: err.message, compositeScore: null, grade: null };
    }

    const { data: auditRow, error: insertErr } = await supabase
      .from('audits')
      .insert({
        contractor_id: contractorId,
        has_website: result.hasWebsite,
        site_unreachable: Boolean(result.siteUnreachable),
        final_url: result.finalUrl || normalizedUrl,
        composite_score: result.compositeScore,
        grade: result.grade?.grade || null,
        grade_color: result.grade?.color || null,
        grade_header: result.grade?.header || null,
        category_scores: result.categoryScores || null,
        top_findings: result.topFindings || null,
        site_structure: result.siteStructureData || null,
        error: result.error || null,
        outreach_excluded_reason: outreachExcludedReason({ finalUrl: result.finalUrl, siteUnreachable: result.siteUnreachable }),
      })
      .select('public_token')
      .single();
    if (insertErr) throw insertErr;

    return res.status(200).json({ redirect: `/audit-report/${slugify(hostname)}/${auditRow.public_token}` });
  } catch (err) {
    console.error('audit/request failed:', err.message);
    return res.status(500).json({ error: 'Something went wrong running your audit — please try again.' });
  }
}
