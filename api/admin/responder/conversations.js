import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';

/**
 * GET /api/admin/responder/conversations — bare-bones thread list (spec
 * §9 Phase 1). needs_attention first, then most recently active.
 */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('responder_conversations')
      .select('id, channel, ai_paused, status, last_message_at, created_at, responder_contacts(id, phone, name)')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    if (error) throw error;

    const statusRank = { needs_attention: 0, open: 1, closed: 2 };
    const rows = (data || [])
      .sort((a, b) => (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9))
      .map((c) => ({
        id: c.id,
        channel: c.channel,
        aiPaused: c.ai_paused,
        status: c.status,
        lastMessageAt: c.last_message_at,
        createdAt: c.created_at,
        contact: c.responder_contacts ? { id: c.responder_contacts.id, phone: c.responder_contacts.phone, name: c.responder_contacts.name } : null,
      }));

    return res.status(200).json({ conversations: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load conversations.' });
  }
}
