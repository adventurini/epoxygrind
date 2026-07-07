import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { fillHorizon } from '../../../lib/carousel/fill-horizon.js';

/**
 * POST /api/admin/carousel/fill — manual "Fill next 30 days" override
 * (spec §4/§6: buttons remain even with full auto cron). Shares
 * fillHorizon() with the nightly cron so behavior can't drift apart.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  try {
    const supabase = getSupabase();
    const horizonDays = Number(req.body?.days) || 30;
    const result = await fillHorizon(supabase, { horizonDays });
    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to fill horizon.' });
  }
}
