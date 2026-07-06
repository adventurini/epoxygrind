import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { PRODUCTS } from '../../lib/product-registry.js';

const PRODUCTS_BY_ID = new Map(PRODUCTS.map((p) => [p.product_id, p]));
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

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
    const limit = Math.min(Number(req.query?.limit) || 2000, 5000);

    const { data, error } = await supabase
      .from('product_clicks')
      .select('product_id, merchant, page, created_at')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = data || [];
    const now = Date.now();

    // Aggregate per product so unmonetized-but-clicked products surface at
    // the top — that's the whole point of tracking these: know which raw
    // (non-affiliate) links are worth setting up an affiliate program for.
    const byProduct = new Map();
    for (const row of rows) {
      const key = row.product_id;
      if (!byProduct.has(key)) {
        const registryProduct = PRODUCTS_BY_ID.get(key);
        byProduct.set(key, {
          productId: key,
          merchant: row.merchant,
          displayName: registryProduct?.display_name || key,
          isAmazon: /amazon\.com/i.test(row.merchant || registryProduct?.merchant || ''),
          monetized: Boolean(registryProduct?.affiliate_url),
          totalClicks: 0,
          last7dClicks: 0,
          lastClickAt: row.created_at,
        });
      }
      const agg = byProduct.get(key);
      agg.totalClicks += 1;
      if (now - new Date(row.created_at).getTime() <= WEEK_MS) agg.last7dClicks += 1;
    }

    const products = [...byProduct.values()].sort((a, b) => b.totalClicks - a.totalClicks);

    return res.status(200).json({
      products,
      recent: rows.slice(0, 100).map((row) => ({
        productId: row.product_id,
        merchant: row.merchant,
        page: row.page,
        createdAt: row.created_at,
      })),
      totalClicks: rows.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load product clicks.' });
  }
}
