import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generateSlideCaptions } from '../../../lib/carousel/generate-captions.js';
import { composeAndStoreFinal } from '../../../lib/carousel/compose-and-store.js';

/**
 * POST /api/admin/carousel/regenerate-slide-caption — regenerates ONE
 * slide's on-image caption, leaving the other 5 untouched (Anthony: "a way
 * to do it individually"). Re-runs the full 6-slide caption generation
 * (so the new line stays narratively consistent with the rest of the
 * story) but only applies the result for the requested position.
 * Recomposites the image if one already exists. { date, position }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const { date, position } = req.body || {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });
  if (!Number.isInteger(position) || position < 1 || position > 6) return res.status(400).json({ error: 'position must be 1-6.' });

  const today = new Date().toISOString().slice(0, 10);
  if (date < today) return res.status(400).json({ error: 'Past days are archived and read-only.' });

  try {
    const supabase = getSupabase();
    const { data: day, error: dayErr } = await supabase
      .from('carousel_days')
      .select('id, audience, carousel_topics(id, title, hook, points, closer)')
      .eq('date', date)
      .maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const { data: slide, error: slideErr } = await supabase
      .from('carousel_slides')
      .select('id, carousel_generations!carousel_slides_active_generation_fkey(image_url)')
      .eq('day_id', day.id)
      .eq('position', position)
      .maybeSingle();
    if (slideErr) throw slideErr;
    if (!slide) return res.status(404).json({ error: 'Slide not found.' });

    const captions = await generateSlideCaptions({ audience: day.audience, topic: day.carousel_topics });
    const caption = captions[position - 1];

    const update = { caption };
    const rawImageUrl = slide.carousel_generations?.image_url;
    if (rawImageUrl) {
      update.final_url = await composeAndStoreFinal({ imageUrl: rawImageUrl, caption, dayId: day.id, position });
    }

    const { error } = await supabase.from('carousel_slides').update(update).eq('id', slide.id);
    if (error) throw error;

    return res.status(200).json({ ok: true, caption, finalUrl: update.final_url || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to regenerate caption.' });
  }
}
