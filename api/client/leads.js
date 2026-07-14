import { requireClientScope } from '../../lib/require-client-scope.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { applyCors } from '../../lib/cors.js';

/**
 * GET /api/client/leads?scope=mirrorball-epoxy — leads/messages for a
 * single client-site admin panel (e.g. mirrorball-epoxy.vercel.app/admin/).
 * Requires a signed-in user whose profiles.client_scope matches the
 * requested scope (or a full EpoxyGrind admin, who can view any scope).
 * Returns only contact_messages whose source_path starts with /{scope} —
 * never any other contractor's data, never the wider admin surface.
 */
export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const scope = String(req.query?.scope || '').trim();
  if (!scope || !/^[a-z0-9-]+$/.test(scope)) {
    return res.status(400).json({ error: 'A valid scope is required.' });
  }

  const auth = await requireClientScope(req, scope);
  if (!auth) return res.status(403).json({ error: 'Not authorized for this scope.' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('contact_messages')
      .select('id, created_at, name, email, zip, message, source_path')
      .like('source_path', `/${scope}%`)
      .order('created_at', { ascending: false })
      .limit(300);

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
    return res.status(500).json({ error: err.message || 'Failed to load leads.' });
  }
}
