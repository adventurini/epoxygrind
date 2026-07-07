import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { composeAndStoreFinal } from '../../../lib/carousel/compose-and-store.js';

/**
 * PATCH /api/admin/carousel/slide — edit one slide's caption text. If the
 * slide already has a generated image, immediately re-composites it with
 * the new caption (auto-applied, per Anthony — no separate approval step
 * exists yet to gate this behind). { date, position, caption }
 */
export default async function handler(req, res) {
  if (req.method !== 'PATCH') {
    res.setHeader('Allow', 'PATCH');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const { date, position } = req.body || {};
  const caption = typeof req.body?.caption === 'string' ? req.body.caption : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });
  if (!Number.isInteger(position) || position < 1 || position > 6) return res.status(400).json({ error: 'position must be 1-6.' });
  if (caption === null) return res.status(400).json({ error: 'caption is required.' });

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return res.status(400).json({ error: 'Past days are archived and read-only.' });

  try {
    const supabase = getSupabase();
    const { data: day, error: dayErr } = await supabase.from('carousel_days').select('id, status').eq('date', date).maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const trimmedCaption = caption.slice(0, 500);

    const { data: slide, error: slideErr } = await supabase
      .from('carousel_slides')
      .select('id, carousel_generations!carousel_slides_active_generation_fkey(image_url)')
      .eq('day_id', day.id)
      .eq('position', position)
      .maybeSingle();
    if (slideErr) throw slideErr;
    if (!slide) return res.status(404).json({ error: 'Slide not found.' });

    const update = { caption: trimmedCaption };
    const rawImageUrl = slide.carousel_generations?.image_url;
    if (rawImageUrl) {
      update.final_url = await composeAndStoreFinal({ imageUrl: rawImageUrl, caption: trimmedCaption, dayId: day.id, position });
    }

    const { error } = await supabase.from('carousel_slides').update(update).eq('id', slide.id);
    if (error) throw error;

    if (day.status === 'drafted' || day.status === 'generated') {
      await supabase.from('carousel_days').update({ status: 'edited' }).eq('id', day.id);
    }

    return res.status(200).json({ ok: true, finalUrl: update.final_url || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to save slide.' });
  }
}
