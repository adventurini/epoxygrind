import { isSupabaseConfigured, getSupabase } from '../../lib/supabase.js';

/** GET /api/audit/public?token=... — unauthenticated, powers the
 * unguessable /audit-report/{token} share link used for cold outreach
 * (no login required to view). Deliberately returns only what a public
 * viewer needs — never the contractor_id or claim state. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const token = String(req.query?.token || '');
  if (!token) return res.status(400).json({ error: 'Missing token.' });

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('audits')
    .select('has_website, site_unreachable, final_url, composite_score, grade, grade_color, grade_header, category_scores, top_findings, audited_at, contractor_id, contractors(name, city, state)')
    .eq('public_token', token)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Audit not found.' });

  return res.status(200).json({
    contractorName: data.contractors?.name || null,
    contractorCity: data.contractors?.city || null,
    contractorState: data.contractors?.state || null,
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
