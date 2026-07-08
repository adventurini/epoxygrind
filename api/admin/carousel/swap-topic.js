import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generateSlideCaptions } from '../../../lib/carousel/generate-captions.js';
import { generatePostCaption } from '../../../lib/carousel/generate-post-caption.js';

/**
 * POST /api/admin/carousel/swap-topic — pull a different least-recently-
 * used topic of the same audience and regenerate captions (spec §4
 * day-level "swap topic"). { date }
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
      .select('id, audience, topic_id')
      .eq('date', date)
      .maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const { data: nextTopic, error: topicErr } = await supabase
      .from('carousel_topics')
      .select('id, title, hook, points, closer')
      .eq('audience', day.audience)
      .neq('id', day.topic_id)
      .order('used_at', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (topicErr) throw topicErr;
    if (!nextTopic) return res.status(409).json({ error: 'No other topic available in this pool.' });

    const [captions, igCaption] = await Promise.all([
      generateSlideCaptions({ audience: day.audience, topic: nextTopic }),
      generatePostCaption({ audience: day.audience, topic: nextTopic }),
    ]);

    await supabase.from('carousel_days').update({ topic_id: nextTopic.id, status: 'drafted', ig_caption: igCaption }).eq('id', day.id);
    for (let i = 0; i < 6; i++) {
      // Detach (not delete) any prior generation — it belonged to the old
      // topic's scenes and no longer matches, but the generations row
      // itself stays as history.
      const { error } = await supabase
        .from('carousel_slides')
        .update({ caption: captions[i], active_generation_id: null, final_url: null })
        .eq('day_id', day.id)
        .eq('position', i + 1);
      if (error) throw error;
    }
    await supabase.from('carousel_topics').update({ used_at: date }).eq('id', nextTopic.id);

    return res.status(200).json({ ok: true, topicTitle: nextTopic.title, captions });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to swap topic.' });
  }
}
