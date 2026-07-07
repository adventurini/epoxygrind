import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

// Some crawls land on a security-challenge/bot-block page instead of the
// real homepage (observed: SGCaptcha's /.well-known/sgcaptcha/ interstitial,
// a ClickCease block page) — the audit still produces a composite_score in
// that case, but it's scoring the wrong page entirely. Flag these so the
// admin table can both warn that the score is unreliable and avoid linking
// out to the broken URL.
const BLOCKED_CRAWL_RE = /captcha|clickcease|\.well-known|challenge|cf_chl|recaptcha|access-denied/i;

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
    const sort = req.query?.sort === 'recent' ? 'recent' : 'score';

    // Supabase's PostgREST enforces its own server-side max-rows cap
    // (1,000) regardless of what .limit() a client requests — a single
    // query silently truncates instead of erroring, which is how this
    // table ended up stuck at exactly 1,000 rows before. Page through with
    // .range() to actually get everything, the same pattern already used
    // by scripts/run-audits.js for the same reason.
    const PAGE_SIZE = 1000;
    let allRows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      let query = supabase
        .from('audits')
        .select('id, contractor_id, has_website, site_unreachable, final_url, composite_score, grade, grade_color, audited_at, public_token, contractors(name, city, state, website, claimed_at, status)')
        .range(from, from + PAGE_SIZE - 1);

      // A secondary tiebreaker is required, not optional — plenty of rows
      // share the same composite_score, and without a unique secondary key
      // Postgres doesn't guarantee stable ordering across separate paged
      // requests. Confirmed this was silently dropping/duplicating rows
      // across the 1000-row page boundary before adding `id` here.
      query = sort === 'recent'
        ? query.order('audited_at', { ascending: false }).order('id', { ascending: true })
        : query.order('composite_score', { ascending: true, nullsFirst: false }).order('id', { ascending: true });

      const { data, error } = await query;
      if (error) throw error;
      if (!data?.length) break;
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) break;
    }

    const rows = allRows
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
        crawlLooksBlocked: Boolean(row.final_url && BLOCKED_CRAWL_RE.test(row.final_url)),
      }));

    const scored = rows.filter((r) => r.compositeScore != null);
    const stats = {
      total: rows.length,
      avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.compositeScore, 0) / scored.length) : null,
      noWebsite: rows.filter((r) => !r.hasWebsite).length,
      unreachable: rows.filter((r) => r.siteUnreachable).length,
      claimed: rows.filter((r) => r.claimedAt).length,
      crawlBlocked: rows.filter((r) => r.crawlLooksBlocked).length,
    };

    return res.status(200).json({ audits: rows, stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load audits.' });
  }
}
