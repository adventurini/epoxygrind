import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';

/**
 * PATCH /api/admin/carousel/day-fields — edit day-level fields that
 * aren't a single slide: the IG/FB post caption and the scheduled post
 * time (spec §9's publish scheduler checks post_time <= now).
 * { date, igCaption?, postTime? }
 */
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const date = req.body?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return res.status(400).json({ error: 'Past days are archived and read-only.' });

  const update = {};
  if (typeof req.body?.igCaption === 'string') update.ig_caption = req.body.igCaption.slice(0, 2200);
  if (typeof req.body?.postTime === 'string' || req.body?.postTime === null) update.post_time = req.body.postTime;
  if (!Object.keys(update).length) return res.status(400).json({ error: 'Nothing to update.' });

  try {
    const supabase = getSupabase();
    const { data: day, error: dayErr } = await supabase.from('carousel_days').select('id').eq('date', date).maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const { error } = await supabase.from('carousel_days').update(update).eq('id', day.id);
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to save.' });
  }
}
