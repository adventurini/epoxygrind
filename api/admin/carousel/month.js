import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';

/**
 * GET /api/admin/carousel/month?month=YYYY-MM — every date in the given
 * month, merged with any existing carousel_days row. Dates with no row are
 * still returned (status "empty") so the calendar grid can render a full
 * month without the frontend having to compute date math itself.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const month = /^\d{4}-\d{2}$/.test(req.query?.month || '') ? req.query.month : null;
  if (!month) return res.status(400).json({ error: 'A month=YYYY-MM query param is required.' });

  try {
    const supabase = getSupabase();
    const [year, mo] = month.split('-').map(Number);
    const start = `${month}-01`;
    const daysInMonth = new Date(Date.UTC(year, mo, 0)).getUTCDate();
    const end = `${month}-${String(daysInMonth).padStart(2, '0')}`;

    const { data, error } = await supabase
      .from('carousel_days')
      .select('date, audience, status, carousel_topics(title)')
      .gte('date', start)
      .lte('date', end);
    if (error) throw error;

    const byDate = new Map((data || []).map((r) => [r.date, r]));
    const today = new Date().toISOString().slice(0, 10);

    const days = Array.from({ length: daysInMonth }, (_, i) => {
      const date = `${month}-${String(i + 1).padStart(2, '0')}`;
      const row = byDate.get(date);
      return {
        date,
        audience: row?.audience || null,
        topicTitle: row?.carousel_topics?.title || null,
        status: row ? (date < today && row.status !== 'archived' ? 'archived' : row.status) : 'empty',
      };
    });

    return res.status(200).json({ days });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load month.' });
  }
}
