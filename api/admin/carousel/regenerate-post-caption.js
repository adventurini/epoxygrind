import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generatePostCaption } from '../../../lib/carousel/generate-post-caption.js';

/** POST /api/admin/carousel/regenerate-post-caption — { date } */
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
      .select('id, audience, carousel_topics(title, hook, points, closer)')
      .eq('date', date)
      .maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const caption = await generatePostCaption({ audience: day.audience, topic: day.carousel_topics });
    const { error } = await supabase.from('carousel_days').update({ ig_caption: caption }).eq('id', day.id);
    if (error) throw error;

    return res.status(200).json({ ok: true, igCaption: caption });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to regenerate post caption.' });
  }
}
