import { requireAdmin } from '../../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { sendSms } from '../../../lib/twilio.js';
import { insertMessage } from '../../../lib/responder/upsert.js';

/**
 * GET /api/admin/responder/messages?conversationId= — thread messages.
 * POST /api/admin/responder/messages { conversationId, body } — manual
 * reply (spec §9 Phase 1: "bare-bones thread view, read + manual reply").
 * Any human reply here is the handoff signal in later phases (spec §3.5:
 * "Any message sent by the account owner... sets ai_paused = true"),
 * already recorded now even though Phase 1 has no AI to pause.
 */
export default async function handler(req, res) {
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Supabase is not configured.' });

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  const supabase = getSupabase();

  if (req.method === 'GET') {
    const conversationId = req.query?.conversationId;
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required.' });
    try {
      const { data, error } = await supabase
        .from('responder_messages')
        .select('id, direction, sender_type, body, delivery_status, created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return res.status(200).json({ messages: data || [] });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to load messages.' });
    }
  }

  if (req.method === 'POST') {
    const { conversationId, body } = req.body || {};
    const text = typeof body === 'string' ? body.trim() : '';
    if (!conversationId) return res.status(400).json({ error: 'conversationId is required.' });
    if (!text) return res.status(400).json({ error: 'A message body is required.' });

    try {
      const { data: conversation, error: convErr } = await supabase
        .from('responder_conversations')
        .select('id, contact_id, responder_contacts(phone, opted_out)')
        .eq('id', conversationId)
        .maybeSingle();
      if (convErr) throw convErr;
      if (!conversation) return res.status(404).json({ error: 'Conversation not found.' });
      if (conversation.responder_contacts?.opted_out) return res.status(400).json({ error: 'This contact has opted out — cannot send.' });

      const twilioMessage = await sendSms({ to: conversation.responder_contacts.phone, body: text });
      const saved = await insertMessage({
        supabase, conversationId, direction: 'out', senderType: 'human', body: text, twilioSid: twilioMessage.sid,
      });

      await supabase.from('responder_conversations').update({ ai_paused: true, status: 'open' }).eq('id', conversationId);

      return res.status(200).json({ ok: true, message: saved });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to send reply.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
