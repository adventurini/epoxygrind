import { randomUUID } from 'node:crypto';
import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generateSlideScenes } from '../../../lib/carousel/generate-scenes.js';
import { generateSlideImage, buildImagePrompt } from '../../../lib/carousel/generate-image.js';
import { composeAndStoreFinal } from '../../../lib/carousel/compose-and-store.js';

/**
 * POST /api/admin/carousel/generate-images — generates all 6 images for
 * one day's slides via the fal.ai FLUX.2 edit endpoint, then immediately
 * composites each slide's current caption onto its image (auto-applied,
 * not gated behind a manual approval step). Sequential, not parallel —
 * each edit call is 4-15s and 6 in a row is well inside a reasonable
 * function timeout. { date }
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

    const { data: config, error: configErr } = await supabase.from('carousel_config').select('value').eq('key', 'characterMasters').maybeSingle();
    if (configErr) throw configErr;
    const masters = config?.value;
    if (!masters?.default) return res.status(409).json({ error: 'No Grinder Dad reference image configured yet.' });

    const { data: day, error: dayErr } = await supabase
      .from('carousel_days')
      .select('id, audience, carousel_topics(title, hook, points, closer)')
      .eq('date', date)
      .maybeSingle();
    if (dayErr) throw dayErr;
    if (!day) return res.status(404).json({ error: 'That day has not been drafted yet.' });

    const { data: slides, error: slidesErr } = await supabase
      .from('carousel_slides')
      .select('id, position, caption')
      .eq('day_id', day.id)
      .order('position', { ascending: true });
    if (slidesErr) throw slidesErr;

    const scenes = await generateSlideScenes({ audience: day.audience, topic: day.carousel_topics });

    const results = [];
    for (const slide of slides) {
      const scene = scenes[slide.position - 1];
      const generationId = randomUUID();

      // Consumer posts end on "the Pro" (Anthony: "The last photo has a
      // pro in it always in the DIY section") — a distinct reference
      // image, only for slide 6 of consumer days.
      const masterUrl = (day.audience === 'consumer' && slide.position === 6 && masters.pro) ? masters.pro : masters.default;
      const prompt = buildImagePrompt(scene);

      const { imageUrl } = await generateSlideImage({
        masterUrl, prompt, dayId: day.id, position: slide.position, generationId,
      });

      const { error: genErr } = await supabase.from('carousel_generations').insert({
        id: generationId, slide_id: slide.id, prompt, image_url: imageUrl, model: 'fal-ai/flux-2/edit',
      });
      if (genErr) throw genErr;

      const finalUrl = await composeAndStoreFinal({ imageUrl, caption: slide.caption, dayId: day.id, position: slide.position });

      const { error: updateErr } = await supabase
        .from('carousel_slides')
        .update({ active_generation_id: generationId, final_url: finalUrl })
        .eq('id', slide.id);
      if (updateErr) throw updateErr;

      results.push({ position: slide.position, imageUrl, finalUrl });
    }

    await supabase.from('carousel_days').update({ status: 'generated' }).eq('id', day.id);

    return res.status(200).json({ ok: true, slides: results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to generate images.' });
  }
}
