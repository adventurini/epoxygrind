import twilioPkg from 'twilio';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { isValidTwilioRequest, sendSms, isTwilioConfigured } from '../../../lib/twilio.js';
import { findOrCreateContact, findOrCreateConversation, insertMessage } from '../../../lib/responder/upsert.js';

const { twiml: { MessagingResponse } } = twilioPkg;

const STOP_KEYWORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);

/**
 * POST /api/webhooks/sms/inbound — Twilio SMS webhook. Phase 1 has no AI
 * yet (spec §9 Phase 1: "bare-bones thread view, read + manual reply") —
 * every inbound message just gets logged and flagged for a human, not
 * auto-replied to. Twilio's Advanced Opt-Out handles STOP at the carrier
 * level already; this is a local mirror of that state, not a replacement.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }
  if (!isSupabaseConfigured() || !isTwilioConfigured()) return res.status(503).send('Not configured');
  if (!isValidTwilioRequest(req, '/api/webhooks/sms/inbound')) return res.status(403).send('Invalid signature');

  const supabase = getSupabase();
  const from = req.body.From;
  const to = req.body.To;
  const body = req.body.Body || '';
  const messageSid = req.body.MessageSid;

  try {
    const { data: phoneRow } = await supabase.from('responder_phone_numbers').select('account_id').eq('twilio_number', to).maybeSingle();
    if (!phoneRow) return res.status(404).send('Unknown number');

    const contact = await findOrCreateContact({ supabase, accountId: phoneRow.account_id, phone: from, source: 'sms' });

    const trimmed = body.trim().toLowerCase();
    if (STOP_KEYWORDS.has(trimmed)) {
      await supabase.from('responder_contacts').update({ opted_out: true }).eq('id', contact.id);
    }

    const { conversation } = await findOrCreateConversation({ supabase, accountId: phoneRow.account_id, contactId: contact.id, channel: 'sms' });

    try {
      await insertMessage({ supabase, conversationId: conversation.id, direction: 'in', senderType: 'contact', body, twilioSid: messageSid });
    } catch (err) {
      // Idempotency: Twilio retries webhooks — a duplicate MessageSid means
      // we've already processed this exact delivery, not a new message.
      if (!/duplicate key/i.test(err.message || '')) throw err;
    }

    if (!contact.opted_out && !STOP_KEYWORDS.has(trimmed)) {
      await supabase.from('responder_conversations').update({ status: 'needs_attention' }).eq('id', conversation.id);

      const { data: config } = await supabase.from('responder_ai_configs').select('owner_alert_phone').eq('account_id', phoneRow.account_id).maybeSingle();
      if (config?.owner_alert_phone) {
        await sendSms({
          to: config.owner_alert_phone,
          body: `Text from ${from}: "${body.slice(0, 120)}" — https://www.epoxygrind.com/app/admin/responder/?conversation=${conversation.id}`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[sms/inbound]', err);
  }

  const twiml = new MessagingResponse();
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
}
