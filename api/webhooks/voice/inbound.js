import twilioPkg from 'twilio';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { isValidTwilioRequest, lookupLineType, sendSms, isTwilioConfigured } from '../../../lib/twilio.js';
import { findOrCreateContact, findOrCreateConversation, createLead, insertMessage, logLeadEvent } from '../../../lib/responder/upsert.js';

const { twiml: { VoiceResponse } } = twilioPkg;

const TEXTBACK_MESSAGE = (companyName) =>
  `Hey, it's ${companyName} — sorry we missed your call! Are you looking for a quote on a garage floor, basement, or a commercial space? Reply here and we'll get you a fast estimate. Reply STOP to opt out.`;

const GREETING_TTS = 'Hey, you\'ve reached us. We\'re out on a floor right now, so I\'m texting you at this number as we speak — check your messages. Talk in a sec!';
const ANONYMOUS_GREETING_TTS = 'We can\'t see your number, so we can\'t text you back automatically. Please leave your name and number after the tone and we\'ll call you right back.';

/**
 * POST /api/webhooks/voice/inbound — Twilio Voice webhook (spec §2.1).
 * Text-first design: no call is ever forwarded or answered by a human.
 * Every inbound call gets a short greeting, the call ends, and (for
 * textable numbers) an SMS conversation begins immediately.
 *
 * Phase 1 only — no AI qualification yet, just the static text-back and a
 * bare-bones thread a human reads/replies to manually.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }
  if (!isSupabaseConfigured() || !isTwilioConfigured()) {
    return res.status(503).send('Not configured');
  }
  if (!isValidTwilioRequest(req, '/api/webhooks/voice/inbound')) {
    return res.status(403).send('Invalid signature');
  }

  const supabase = getSupabase();
  const from = req.body.From;
  const to = req.body.To;
  const callSid = req.body.CallSid;

  try {
    const { data: phoneRow } = await supabase
      .from('responder_phone_numbers')
      .select('account_id, greeting_url')
      .eq('twilio_number', to)
      .maybeSingle();
    if (!phoneRow) return res.status(404).send('Unknown number');

    const { data: config } = await supabase
      .from('responder_ai_configs')
      .select('*')
      .eq('account_id', phoneRow.account_id)
      .maybeSingle();

    const { data: account } = await supabase
      .from('responder_accounts')
      .select('company_name')
      .eq('id', phoneRow.account_id)
      .maybeSingle();

    // Blocked/anonymous caller ID: Twilio passes the literal string
    // "anonymous" for restricted callers — no number exists to text back.
    const isAnonymous = !from || from.toLowerCase() === 'anonymous';
    const lineType = isAnonymous ? 'unknown' : await lookupLineType(from);
    const isTextable = !isAnonymous && lineType !== 'landline' && lineType !== 'voip';

    const { data: call, error: callErr } = await supabase
      .from('responder_calls')
      .insert({
        account_id: phoneRow.account_id,
        twilio_sid: callSid,
        was_missed: true,
        line_type: lineType,
      })
      .select('id, contact_id')
      .single();
    if (callErr) throw callErr;

    const twiml = new VoiceResponse();

    if (!isTextable) {
      // Un-textable caller (spec §2.1.1) — no text-back attempted, fall
      // back to a voicemail-style recording + high-priority alert.
      const say = isAnonymous ? ANONYMOUS_GREETING_TTS : 'We can\'t text this type of number. Please leave your name and number after the tone and we\'ll call you right back.';
      twiml.say(say);
      twiml.record({ maxLength: 90, transcribe: true, action: '/api/webhooks/voice/recording' });

      if (config?.owner_alert_phone) {
        await sendSms({
          to: config.owner_alert_phone,
          body: `Voicemail-style call from ${isAnonymous ? 'a blocked number' : from} — can't text this number back. Check the recording.`,
        }).catch(() => {});
      }

      res.setHeader('Content-Type', 'text/xml');
      return res.status(200).send(twiml.toString());
    }

    const contact = await findOrCreateContact({ supabase, accountId: phoneRow.account_id, phone: from, source: 'missed_call' });
    await supabase.from('responder_calls').update({ contact_id: contact.id }).eq('id', call.id);

    const { conversation, isNew } = await findOrCreateConversation({ supabase, accountId: phoneRow.account_id, contactId: contact.id, channel: 'sms' });
    const lead = await createLead({ supabase, accountId: phoneRow.account_id, contactId: contact.id, source: 'missed_call' });

    const messageBody = isNew
      ? TEXTBACK_MESSAGE(account?.company_name || 'us')
      : 'Saw you called again — still with you here 👇';

    await sendSms({ to: from, body: messageBody });
    await insertMessage({ supabase, conversationId: conversation.id, direction: 'out', senderType: 'system', body: messageBody });
    await supabase.from('responder_calls').update({ textback_sent: true }).eq('id', call.id);
    await logLeadEvent({ supabase, leadId: lead.id, type: 'textback_sent' });

    if (!isNew) {
      await supabase.from('responder_conversations').update({ status: 'needs_attention' }).eq('id', conversation.id);
    }

    if (config?.owner_alert_phone) {
      await sendSms({
        to: config.owner_alert_phone,
        body: `New call lead: ${from} — text-back sent. https://www.epoxygrind.com/app/admin/responder/?conversation=${conversation.id}`,
      }).catch(() => {});
    }

    if (phoneRow.greeting_url) {
      twiml.play(phoneRow.greeting_url);
    } else {
      twiml.say(GREETING_TTS);
    }
    twiml.hangup();

    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  } catch (err) {
    console.error('[voice/inbound]', err);
    const twiml = new VoiceResponse();
    twiml.say('Sorry, something went wrong. Please try again shortly.');
    twiml.hangup();
    res.setHeader('Content-Type', 'text/xml');
    return res.status(200).send(twiml.toString());
  }
}
