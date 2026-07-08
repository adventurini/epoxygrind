import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { publishInstagramCarousel, publishFacebookPagePost } from '../../../lib/carousel/publish-meta.js';

/**
 * POST /api/admin/carousel/publish — publishes a day's 6 final images to
 * the selected platforms (spec §9). No approval gate exists yet, so this
 * is a real, immediate, public action the moment it's clicked — there is
 * no dry-run. { date, platforms: ('ig'|'fb')[] }
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
  const platforms = Array.isArray(req.body?.platforms) ? req.body.platforms.filter((p) => p === 'ig' || p === 'fb') : [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });
  if (!platforms.length) return res.status(400).json({ error: 'At least one platform (ig, fb) is required.' });

  try {
    const supabase = getSupabase();

    const { data: config, error: configErr } = await supabase.from('carousel_config').select('value').eq('key', 'metaCredentials').maybeSingle();
    if (configErr) throw configErr;
    const creds = config?.value;
    if (!creds?.pageAccessToken) return res.status(409).json({ error: 'Meta credentials are not configured yet.' });
    if (platforms.includes('ig') && !creds.igUserId) return res.status(409).json({ error: 'Instagram user ID is not configured.' });
    if (platforms.includes('fb') && !creds.pageId) return res.status(409).json({ error: 'Facebook Page ID is not configured.' });

    const { data: day, error: dayErr } = await supabase.from('carousel_days').select('id, ig_caption').eq('date', date).maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });
    if (!day.ig_caption) return res.status(400).json({ error: 'This day has no post caption yet.' });

    const { data: slides, error: slidesErr } = await supabase
      .from('carousel_slides')
      .select('position, final_url')
      .eq('day_id', day.id)
      .order('position', { ascending: true });
    if (slidesErr) throw slidesErr;
    if (slides.length !== 6 || slides.some((s) => !s.final_url)) {
      return res.status(400).json({ error: 'All 6 slides need a generated image before this day can be published.' });
    }
    const imageUrls = slides.map((s) => s.final_url);

    const results = [];
    for (const platform of platforms) {
      try {
        const { platformPostId } = platform === 'ig'
          ? await publishInstagramCarousel({ igUserId: creds.igUserId, accessToken: creds.pageAccessToken, imageUrls, caption: day.ig_caption })
          : await publishFacebookPagePost({ pageId: creds.pageId, accessToken: creds.pageAccessToken, imageUrls, caption: day.ig_caption });

        await supabase.from('carousel_publishes').insert({ day_id: day.id, platform, status: 'published', platform_post_id: platformPostId });
        results.push({ platform, ok: true, platformPostId });
      } catch (err) {
        await supabase.from('carousel_publishes').insert({ day_id: day.id, platform, status: 'failed', error: err.message });
        results.push({ platform, ok: false, error: err.message });
      }
    }

    if (results.some((r) => r.ok)) {
      await supabase.from('carousel_days').update({ status: 'published' }).eq('id', day.id);
    }

    return res.status(200).json({ results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to publish.' });
  }
}
