import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { fillHorizon } from '../../lib/carousel/fill-horizon.js';

/**
 * GET /api/cron/carousel-nightly — spec §6 "DECIDED: full auto via nightly
 * cron". Vercel invokes scheduled functions with
 * `Authorization: Bearer ${CRON_SECRET}` automatically when that env var
 * is set — verify it so this can't be hit by anyone else.
 *
 * Step 2 (image generation for drafted days) isn't implemented yet — the
 * character LoRA hasn't been trained, so there's nothing to generate with.
 * Left as an explicit, logged no-op rather than silently doing nothing, so
 * it's obvious from the response/logs why days stay at "drafted" instead
 * of reaching "generated".
 */
export default async function handler(req, res) {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (got !== expected) return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  try {
    const supabase = getSupabase();

    const today = new Date().toISOString().slice(0, 10);
    const { error: archiveErr } = await supabase
      .from('carousel_days')
      .update({ status: 'archived' })
      .lt('date', today)
      .neq('status', 'archived');
    if (archiveErr) throw archiveErr;

    const horizonResult = await fillHorizon(supabase, { horizonDays: 30 });

    const imageStep = { skipped: true, reason: 'No Grinder Dad LoRA trained yet — character sheet approval is pending.' };

    console.log('[carousel-nightly]', JSON.stringify({ horizonResult, imageStep }));
    return res.status(200).json({ ok: true, horizonResult, imageStep });
  } catch (err) {
    console.error('[carousel-nightly] FATAL', err);
    return res.status(500).json({ error: err.message || 'Nightly job failed.' });
  }
}
