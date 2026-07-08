import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';

function mask(token) {
  if (!token) return null;
  return token.length <= 8 ? '••••••••' : `${token.slice(0, 4)}…${token.slice(-4)}`;
}

/**
 * GET/POST /api/admin/carousel/meta-config — Meta Page access token + IG
 * business account ID + FB Page ID, stored in carousel_config rather than
 * env vars so the token can be rotated without a redeploy (spec §9: token
 * expires ~60 days, needs proactive refresh).
 * GET returns the token masked — never echoes the real value back.
 */
export default async function handler(req, res) {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const supabase = getSupabase();

  if (req.method === 'GET') {
    try {
      const { data, error } = await supabase.from('carousel_config').select('value, updated_at').eq('key', 'metaCredentials').maybeSingle();
      if (error) throw error;
      const value = data?.value || {};
      return res.status(200).json({
        igUserId: value.igUserId || null,
        pageId: value.pageId || null,
        pageAccessTokenMasked: mask(value.pageAccessToken),
        tokenObtainedAt: value.tokenObtainedAt || null,
        updatedAt: data?.updated_at || null,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to load Meta config.' });
    }
  }

  if (req.method === 'POST') {
    const { igUserId, pageId, pageAccessToken } = req.body || {};
    try {
      const { data: existing } = await supabase.from('carousel_config').select('value').eq('key', 'metaCredentials').maybeSingle();
      const value = { ...(existing?.value || {}) };
      if (typeof igUserId === 'string') value.igUserId = igUserId.trim() || null;
      if (typeof pageId === 'string') value.pageId = pageId.trim() || null;
      if (typeof pageAccessToken === 'string' && pageAccessToken.trim()) {
        value.pageAccessToken = pageAccessToken.trim();
        value.tokenObtainedAt = new Date().toISOString();
      }

      const { error } = await supabase.from('carousel_config').upsert({ key: 'metaCredentials', value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to save Meta config.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
