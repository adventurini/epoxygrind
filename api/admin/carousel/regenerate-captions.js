import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generateSlideCaptions } from '../../../lib/carousel/generate-captions.js';
import { generatePostCaption } from '../../../lib/carousel/generate-post-caption.js';
import { composeAndStoreFinal } from '../../../lib/carousel/compose-and-store.js';

/**
 * POST /api/admin/carousel/regenerate-captions — re-runs caption
 * generation for a day's already-assigned topic (spec §4 day-level
 * "regenerate all captions"). Does not change the topic; see
 * swap-topic.js for that.
 *
 * Regenerates the whole day cohesively, not just the caption text field:
 * any slide that already has a generated image gets recomposited with the
 * new caption (confirmed real bug otherwise — the on-image text and the
 * caption field silently went out of sync), and the IG/FB post caption
 * regenerates alongside so the day is never left with on-image text that
 * doesn't match what's burned in, or missing its post caption. { date }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const date = req.body?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });

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

    const [captions, igCaption] = await Promise.all([
      generateSlideCaptions({ audience: day.audience, topic: day.carousel_topics }),
      generatePostCaption({ audience: day.audience, topic: day.carousel_topics }),
    ]);

    const { data: slides, error: slidesErr } = await supabase
      .from('carousel_slides')
      .select('id, position, carousel_generations!carousel_slides_active_generation_fkey(image_url)')
      .eq('day_id', day.id)
      .order('position', { ascending: true });
    if (slidesErr) throw slidesErr;

    for (const slide of slides) {
      const caption = captions[slide.position - 1];
      const update = { caption };
      const rawImageUrl = slide.carousel_generations?.image_url;
      if (rawImageUrl) {
        update.final_url = await composeAndStoreFinal({ imageUrl: rawImageUrl, caption, dayId: day.id, position: slide.position });
      }
      const { error } = await supabase.from('carousel_slides').update(update).eq('id', slide.id);
      if (error) throw error;
    }

    await supabase.from('carousel_days').update({ ig_caption: igCaption }).eq('id', day.id);

    return res.status(200).json({ ok: true, captions, igCaption });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to regenerate captions.' });
  }
}
