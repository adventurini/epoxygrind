import { isSupabaseConfigured, getSupabase } from '../../lib/supabase.js';
import { getContractorFromRequest } from '../../lib/contractor-auth.js';

/** GET /api/contractor/audit — the authenticated contractor's own audit
 * result (master spec §Phase 2 audit display). One row per contractor in
 * `audits`, written by scripts/run-audits.js. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const contractor = await getContractorFromRequest(req);
  if (!contractor) return res.status(401).json({ error: 'Not signed in.' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audits')
    .select('has_website, site_unreachable, final_url, composite_score, grade, grade_color, grade_header, category_scores, top_findings, audited_at')
    .eq('contractor_id', contractor.id)
    .order('audited_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return res.status(500).json({ error: 'Could not load your audit.' });
  if (!data) return res.status(404).json({ error: 'No audit yet.' });

  return res.status(200).json({
    hasWebsite: data.has_website,
    siteUnreachable: data.site_unreachable,
    finalUrl: data.final_url,
    compositeScore: data.composite_score,
    grade: data.grade,
    gradeColor: data.grade_color,
    gradeHeader: data.grade_header,
    categoryScores: data.category_scores,
    topFindings: data.top_findings,
    auditedAt: data.audited_at,
  });
}
