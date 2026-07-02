import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

const ADMIN_ESTIMATE_COLUMNS =
  'id, created_at, updated_at, user_id, customer_name, email, location, finish_label, ' +
  'pattern_label, color_label, sq_ft, total_low, total_high, space_type';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  try {
    const supabase = getSupabase();
    const limit = Math.min(Number(req.query?.limit) || 200, 500);

    const { data, error } = await supabase
      .from('estimates')
      .select(ADMIN_ESTIMATE_COLUMNS)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.status(200).json({
      estimates: (data || []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        userId: row.user_id,
        customerName: row.customer_name,
        email: row.email,
        location: row.location,
        finishLabel: row.finish_label,
        patternLabel: row.pattern_label,
        colorLabel: row.color_label,
        sqFt: row.sq_ft,
        totalLow: row.total_low,
        totalHigh: row.total_high,
        spaceType: row.space_type,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load estimates.' });
  }
}
