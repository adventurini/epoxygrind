import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { sendSms, isTwilioConfigured } from '../../../lib/twilio.js';
import { findOrCreateContact, findOrCreateConversation, createLead, insertMessage, logLeadEvent } from '../../../lib/responder/upsert.js';

const ACCOUNT_ID = '00000000-0000-0000-0000-000000000001'; // epoxygrind.com's own account (spec: "account #1")

function toE164(raw) {
  const digits = String(raw || '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

/**
 * POST /api/webhooks/web/capture — spec §4's "core move: convert web chat
 * to SMS." Phase 1 has no AI loop yet, so this is a simplified version:
 * the widget itself asks 1-2 questions and captures a phone number, then
 * this endpoint hands off to a real text thread from the tracking number
 * — "getting the number IS the conversion event," the web session can die
 * from here. { name?, phone, message? }
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) return res.status(503).json({ error: 'Not configured.' });

  const phone = toE164(req.body?.phone);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : null;
  const message = typeof req.body?.message === 'string' ? req.body.message.trim().slice(0, 500) : '';
  if (!phone) return res.status(400).json({ error: 'A valid US phone number is required.' });

  try {
    const supabase = getSupabase();

    const contact = await findOrCreateContact({ supabase, accountId: ACCOUNT_ID, phone, source: 'web_chat' });
    if (name && !contact.name) {
      await supabase.from('responder_contacts').update({ name }).eq('id', contact.id);
    }

    const { conversation, isNew } = await findOrCreateConversation({ supabase, accountId: ACCOUNT_ID, contactId: contact.id, channel: 'web' });
    const lead = await createLead({ supabase, accountId: ACCOUNT_ID, contactId: contact.id, source: 'web_chat' });
    await logLeadEvent({ supabase, leadId: lead.id, type: 'web_chat_captured' });

    if (message) {
      await insertMessage({ supabase, conversationId: conversation.id, direction: 'in', senderType: 'contact', body: message });
    }

    const replyBody = isNew
      ? "Hey, it's EpoxyGrind! Thanks for checking us out — this is a real text from the same number your customers would get. Curious how it'd work for your business? Just reply here."
      : 'Hey, it\'s EpoxyGrind again — good to hear from you. Reply here and we\'ll pick up where we left off.';

    let smsSent = false;
    if (isTwilioConfigured()) {
      try {
        await sendSms({ to: phone, body: replyBody });
        await insertMessage({ supabase, conversationId: conversation.id, direction: 'out', senderType: 'system', body: replyBody });
        smsSent = true;
      } catch (err) {
        // Compliance (A2P 10DLC) may still be pending — don't fail the
        // whole capture just because the confirmation text couldn't send;
        // the lead is still real and saved.
        console.error('[web/capture] SMS send failed:', err.message);
      }
    }

    if (!isNew) {
      await supabase.from('responder_conversations').update({ status: 'needs_attention' }).eq('id', conversation.id);
    }

    return res.status(200).json({ ok: true, smsSent });
  } catch (err) {
    console.error('[web/capture]', err);
    return res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
}
