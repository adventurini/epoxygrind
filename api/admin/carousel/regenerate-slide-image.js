import { randomUUID } from 'node:crypto';
import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { generateSlideScenes } from '../../../lib/carousel/generate-scenes.js';
import { generateSlideImage, buildImagePrompt } from '../../../lib/carousel/generate-image.js';
import { composeAndStoreFinal } from '../../../lib/carousel/compose-and-store.js';

/**
 * POST /api/admin/carousel/regenerate-slide-image — regenerates ONE
 * slide's image (spec §2.4: "each slide has a small prompt input... base
 * prompt + user's delta"). Reuses the slide's last stored prompt as the
 * base rather than re-deriving a fresh scene, so a delta like "more
 * panic" actually nudges the existing composition instead of rerolling
 * everything. Falls back to a fresh scene only if this slide has never
 * been generated before. Keeps the prior generation row (history), just
 * detaches it. { date, position, deltaPrompt? }
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
  const deltaPrompt = typeof req.body?.deltaPrompt === 'string' ? req.body.deltaPrompt.trim() : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) return res.status(400).json({ error: 'A valid date is required.' });
  if (!Number.isInteger(position) || position < 1 || position > 6) return res.status(400).json({ error: 'position must be 1-6.' });

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

    const { data: slide, error: slideErr } = await supabase
      .from('carousel_slides')
      .select('id, caption, carousel_generations!carousel_slides_active_generation_fkey(prompt)')
      .eq('day_id', day.id)
      .eq('position', position)
      .maybeSingle();
    if (slideErr) throw slideErr;
    if (!slide) return res.status(404).json({ error: 'Slide not found.' });

    const basePrompt = slide.carousel_generations?.prompt;
    let prompt;
    if (basePrompt) {
      prompt = deltaPrompt ? `${basePrompt} ${deltaPrompt}.` : basePrompt;
    } else {
      // Never generated before — derive a fresh scene the same way a full
      // day-generation would (spec §2.3), then apply the delta if given.
      const scenes = await generateSlideScenes({ audience: day.audience, topic: day.carousel_topics });
      const scene = deltaPrompt ? `${scenes[position - 1]} ${deltaPrompt}.` : scenes[position - 1];
      prompt = buildImagePrompt(scene);
    }

    const masterUrl = (day.audience === 'consumer' && position === 6 && masters.pro) ? masters.pro : masters.default;
    const generationId = randomUUID();

    const { imageUrl } = await generateSlideImage({ masterUrl, prompt, dayId: day.id, position, generationId });

    const { error: genErr } = await supabase.from('carousel_generations').insert({
      id: generationId, slide_id: slide.id, prompt, delta_prompt: deltaPrompt || null, image_url: imageUrl, model: 'fal-ai/flux-2/edit',
    });
    if (genErr) throw genErr;

    const finalUrl = await composeAndStoreFinal({ imageUrl, caption: slide.caption, dayId: day.id, position });

    const { error: updateErr } = await supabase
      .from('carousel_slides')
      .update({ active_generation_id: generationId, final_url: finalUrl })
      .eq('id', slide.id);
    if (updateErr) throw updateErr;

    return res.status(200).json({ ok: true, imageUrl, finalUrl });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to regenerate slide image.' });
  }
}
