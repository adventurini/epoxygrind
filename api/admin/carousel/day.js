import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';

/** GET /api/admin/carousel/day?date=YYYY-MM-DD — full drill-in detail. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const date = req.query?.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A date=YYYY-MM-DD query param is required.' });

  try {
    const supabase = getSupabase();
    const { data: day, error } = await supabase
      .from('carousel_days')
      .select('id, date, audience, status, post_time, ig_caption, approved_at, carousel_topics(id, title, hook, points, closer, source)')
      .eq('date', date)
      .maybeSingle();
    if (error) throw error;
    if (!day) return res.status(200).json({ day: null });

    // Two FKs exist between these tables (slides.active_generation_id ->
    // generations.id, and generations.slide_id -> slides.id) — the
    // constraint-name hint picks the right one for this embed.
    const { data: slides, error: slidesErr } = await supabase
      .from('carousel_slides')
      .select('id, position, caption, overlay, final_url, carousel_generations!carousel_slides_active_generation_fkey(image_url, prompt)')
      .eq('day_id', day.id)
      .order('position', { ascending: true });
    if (slidesErr) throw slidesErr;

    const today = new Date().toISOString().slice(0, 10);
    return res.status(200).json({
      day: {
        date: day.date,
        audience: day.audience,
        status: date < today && day.status !== 'archived' ? 'archived' : day.status,
        readOnly: date < today,
        postTime: day.post_time,
        igCaption: day.ig_caption,
        approvedAt: day.approved_at,
        topic: day.carousel_topics,
        slides: (slides || []).map((s) => ({
          id: s.id,
          position: s.position,
          caption: s.caption,
          overlay: s.overlay,
          finalUrl: s.final_url,
          imageUrl: s.carousel_generations?.image_url || null,
        })),
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load day.' });
  }
}
