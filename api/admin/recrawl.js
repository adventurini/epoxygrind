import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { outreachExcludedReason } from '../../lib/audit/outreach-eligibility.js';

const AUDIT_TIMEOUT_MS = 150_000;

/**
 * POST /api/admin/recrawl { contractorId } — admin-only. Forces a fresh
 * audit run regardless of an existing (possibly stale/crawl-blocked) row,
 * unlike the public /api/audit/request, which deliberately reuses a fresh
 * existing audit and has no way to distinguish a bad score from a good
 * one. Inserts a new audits row rather than overwriting the old one, so
 * the failure history (and its outreach_excluded_reason) stays intact.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const contractorId = Number(req.body?.contractorId);
  if (!contractorId) return res.status(400).json({ error: 'A contractorId is required.' });

  try {
    const supabase = getSupabase();
    const { data: contractor, error: lookupErr } = await supabase
      .from('contractors')
      .select('id, name, website, phones')
      .eq('id', contractorId)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!contractor) return res.status(404).json({ error: 'Contractor not found.' });
    if (!contractor.website) return res.status(400).json({ error: 'This contractor has no website on file.' });

    const { runAudit } = await import('../../lib/audit/index.js');
    let result;
    try {
      result = await Promise.race([
        runAudit({ website: contractor.website, phones: contractor.phones || [] }, 0),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Audit timed out')), AUDIT_TIMEOUT_MS)),
      ]);
    } catch (err) {
      result = { hasWebsite: true, siteUnreachable: true, error: err.message, compositeScore: null, grade: null };
    }

    const { data: auditRow, error: insertErr } = await supabase
      .from('audits')
      .insert({
        contractor_id: contractor.id,
        has_website: result.hasWebsite,
        site_unreachable: Boolean(result.siteUnreachable),
        final_url: result.finalUrl || contractor.website,
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
      .select('public_token, composite_score, final_url, outreach_excluded_reason')
      .single();
    if (insertErr) throw insertErr;

    return res.status(200).json({
      ok: true,
      publicToken: auditRow.public_token,
      compositeScore: auditRow.composite_score,
      finalUrl: auditRow.final_url,
      outreachExcludedReason: auditRow.outreach_excluded_reason,
      error: result.error || null,
    });
  } catch (err) {
    console.error('admin/recrawl failed:', err.message);
    return res.status(500).json({ error: 'Recrawl failed — please try again.' });
  }
}
