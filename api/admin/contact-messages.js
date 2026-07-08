import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

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
      .from('contact_messages')
      .select('id, created_at, name, email, zip, message, source_path')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return res.status(200).json({
      messages: (data || []).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        name: row.name,
        email: row.email,
        zip: row.zip,
        message: row.message,
        sourcePath: row.source_path,
      })),
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load messages.' });
  }
}
