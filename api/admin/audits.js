import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

/**
 * GET /api/admin/audits — every website audit, joined with its contractor,
 * for the "which sites are we sitting on the biggest opportunity for"
 * admin view. Sorted worst-score-first by default since that's the most
 * actionable ordering for outreach, not just a raw activity log.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  try {
    const supabase = getSupabase();
    const limit = Math.min(Number(req.query?.limit) || 500, 2500);
    const sort = req.query?.sort === 'recent' ? 'recent' : 'score';

    let query = supabase
      .from('audits')
      .select('contractor_id, has_website, site_unreachable, final_url, composite_score, grade, grade_color, audited_at, public_token, contractors(name, city, state, website, claimed_at, status)')
      .limit(limit);

    query = sort === 'recent'
      ? query.order('audited_at', { ascending: false })
      : query.order('composite_score', { ascending: true, nullsFirst: false });

    const { data, error } = await query;
    if (error) throw error;

    const rows = (data || [])
      .filter((row) => row.contractors) // a handful of self-serve/orphaned rows might not join cleanly — skip rather than crash the table
      .map((row) => ({
        contractorId: row.contractor_id,
        name: row.contractors.name,
        city: row.contractors.city,
        state: row.contractors.state,
        website: row.contractors.website,
        finalUrl: row.final_url,
        hasWebsite: row.has_website,
        siteUnreachable: row.site_unreachable,
        compositeScore: row.composite_score,
        grade: row.grade,
        gradeColor: row.grade_color,
        auditedAt: row.audited_at,
        publicToken: row.public_token,
        claimedAt: row.contractors.claimed_at,
        isSelfServe: row.contractors.status === 'self_serve',
      }));

    const scored = rows.filter((r) => r.compositeScore != null);
    const stats = {
      total: rows.length,
      avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.compositeScore, 0) / scored.length) : null,
      noWebsite: rows.filter((r) => !r.hasWebsite).length,
      unreachable: rows.filter((r) => r.siteUnreachable).length,
      claimed: rows.filter((r) => r.claimedAt).length,
    };

    return res.status(200).json({ audits: rows, stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load audits.' });
  }
}
