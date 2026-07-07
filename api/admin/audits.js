import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { CONTRACTORS } from '../../lib/contractors.js';

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
        .select('id, contractor_id, has_website, site_unreachable, final_url, composite_score, grade, grade_color, audited_at, public_token, outreach_excluded_reason, contractors(name, city, state, website, claimed_at, status, phones, contact_phone, place_id)')
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

    // Bulk-fetch pipeline stage per contractor so the table can show
    // current status without a request per row — most contractors have no
    // row here yet (pipeline only gets created on first interaction).
    let pipelineRows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('contractor_pipeline')
        .select('contractor_id, stage, answered')
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      pipelineRows = pipelineRows.concat(data);
      if (data.length < PAGE_SIZE) break;
    }
    const pipelineByContractor = new Map(pipelineRows.map((p) => [p.contractor_id, p]));

    // Bulk-fetch the latest logged contact attempt (a note with a method —
    // plain freeform notes don't count) per contractor, same pattern as the
    // pipeline fetch above. Ordered so the first row seen per contractor_id
    // is the most recent.
    let contactRows = [];
    for (let from = 0; ; from += PAGE_SIZE) {
      const { data, error } = await supabase
        .from('contractor_notes')
        .select('contractor_id, method, created_at')
        .not('method', 'is', null)
        .order('contractor_id', { ascending: true })
        .order('created_at', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data?.length) break;
      contactRows = contactRows.concat(data);
      if (data.length < PAGE_SIZE) break;
    }
    const lastContactByContractor = new Map();
    for (const c of contactRows) {
      if (!lastContactByContractor.has(c.contractor_id)) lastContactByContractor.set(c.contractor_id, c);
    }

    const rows = allRows
      .filter((row) => row.contractors) // a handful of self-serve/orphaned rows might not join cleanly — skip rather than crash the table
      .map((row) => ({
        contractorId: row.contractor_id,
        name: row.contractors.name,
        city: row.contractors.city,
        state: row.contractors.state,
        website: row.contractors.website,
        // Prefer the contractor's own provided number (contact_phone, set
        // when they claim their listing) over the scraped public phones[0]
        // — but almost nothing is claimed yet, so phones[0] carries most
        // rows in practice.
        phone: row.contractors.contact_phone || row.contractors.phones?.[0] || null,
        // The public directory is a separate static build from
        // content/data/enriched.json (lib/contractors.js), keyed by Google
        // place_id — not every audited contractor is actually live there
        // (passesQualityBar() requires phones + service_areas + a verified
        // Google rating), so this is genuinely null for a lot of rows.
        listingUrl: (() => {
          const listing = row.contractors.place_id ? CONTRACTORS.find((c) => c.place_id === row.contractors.place_id) : null;
          return listing ? `/contractors/${listing.state_slug}/${listing.slug}/` : null;
        })(),
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
        // Durable, stored on the row (not re-derived here) so a future
        // outreach/campaign process can exclude these by a plain query
        // instead of re-implementing this logic.
        outreachExcludedReason: row.outreach_excluded_reason,
        crawlLooksBlocked: row.outreach_excluded_reason === 'crawl_blocked',
        pipelineStage: pipelineByContractor.get(row.contractor_id)?.stage || 'not_contacted',
        pipelineAnswered: pipelineByContractor.get(row.contractor_id)?.answered ?? null,
        lastContactMethod: lastContactByContractor.get(row.contractor_id)?.method || null,
        lastContactedAt: lastContactByContractor.get(row.contractor_id)?.created_at || null,
      }));

    const scored = rows.filter((r) => r.compositeScore != null);
    const stats = {
      total: rows.length,
      avgScore: scored.length ? Math.round(scored.reduce((s, r) => s + r.compositeScore, 0) / scored.length) : null,
      noWebsite: rows.filter((r) => !r.hasWebsite).length,
      unreachable: rows.filter((r) => r.siteUnreachable).length,
      claimed: rows.filter((r) => r.claimedAt).length,
      crawlBlocked: rows.filter((r) => r.crawlLooksBlocked).length,
      outreachExcluded: rows.filter((r) => r.outreachExcludedReason).length,
    };

    return res.status(200).json({ audits: rows, stats });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load audits.' });
  }
}
