import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

const VALID_STAGES = ['not_contacted', 'called', 'audit_texted', 'responded', 'no_response', 'rebuilt', 'lost'];
const VALID_METHODS = ['call', 'text', 'email', 'in_person', 'other'];

/**
 * GET/PATCH/POST /api/admin/pipeline — per-contractor outreach tracking
 * (call status, whether they responded, a free-form notes log). Separate
 * from contractors/audits since this is about us working the lead, not
 * about the contractor's site or listing.
 *
 * GET ?contractorId=N -> { stage, answered, notes: [{id, note, method, createdAt}], lastContact: {method, at} | null }
 * PATCH { contractorId, stage?, answered? } -> upserts the pipeline row
 * POST { contractorId, note, method? } -> appends a note; method marks it as an actual contact attempt (call/text/email/in_person/other) vs. a plain observation
 */
export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const contractorId = Number(req.query?.contractorId);
    if (!contractorId) return res.status(400).json({ error: 'A contractorId is required.' });

    try {
      const [{ data: pipeline }, { data: notes }] = await Promise.all([
        supabase.from('contractor_pipeline').select('stage, answered, updated_at').eq('contractor_id', contractorId).maybeSingle(),
        supabase.from('contractor_notes').select('id, note, method, created_at').eq('contractor_id', contractorId).order('created_at', { ascending: false }),
      ]);

      const lastContactNote = (notes || []).find((n) => n.method);

      return res.status(200).json({
        stage: pipeline?.stage || 'not_contacted',
        answered: pipeline?.answered ?? null,
        updatedAt: pipeline?.updated_at || null,
        notes: (notes || []).map((n) => ({ id: n.id, note: n.note, method: n.method || null, createdAt: n.created_at })),
        lastContact: lastContactNote ? { method: lastContactNote.method, at: lastContactNote.created_at } : null,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to load pipeline data.' });
    }
  }

  if (req.method === 'PATCH') {
    const contractorId = Number(req.body?.contractorId);
    if (!contractorId) return res.status(400).json({ error: 'A contractorId is required.' });

    const update = {};
    if (req.body?.stage !== undefined) {
      if (!VALID_STAGES.includes(req.body.stage)) return res.status(400).json({ error: 'Invalid stage.' });
      update.stage = req.body.stage;
    }
    if (req.body?.answered !== undefined) {
      update.answered = req.body.answered === null ? null : Boolean(req.body.answered);
    }
    if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update.' });
    update.updated_at = new Date().toISOString();

    try {
      const { error } = await supabase
        .from('contractor_pipeline')
        .upsert({ contractor_id: contractorId, ...update }, { onConflict: 'contractor_id' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save.' });
    }
  }

  if (req.method === 'POST') {
    const contractorId = Number(req.body?.contractorId);
    const note = String(req.body?.note || '').trim();
    const method = req.body?.method || null;
    if (!contractorId) return res.status(400).json({ error: 'A contractorId is required.' });
    if (!note) return res.status(400).json({ error: 'A note is required.' });
    if (method && !VALID_METHODS.includes(method)) return res.status(400).json({ error: 'Invalid contact method.' });

    try {
      const { data, error } = await supabase
        .from('contractor_notes')
        .insert({ contractor_id: contractorId, note: note.slice(0, 5000), method })
        .select('id, note, method, created_at')
        .single();
      if (error) throw error;
      return res.status(200).json({ id: data.id, note: data.note, method: data.method, createdAt: data.created_at });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Failed to save note.' });
    }
  }

  res.setHeader('Allow', 'GET, PATCH, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
