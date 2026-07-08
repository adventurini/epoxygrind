import twilioPkg from 'twilio';
import { getSupabase, isSupabaseConfigured } from '../../../lib/supabase.js';
import { isValidTwilioRequest, sendSms, isTwilioConfigured, isTwilioWebhookValidationConfigured } from '../../../lib/twilio.js';
import { findOrCreateContact, createLead } from '../../../lib/responder/upsert.js';

const { twiml: { VoiceResponse } } = twilioPkg;

/**
 * POST /api/webhooks/voice/recording — Twilio's <Record action> callback
 * for the landline/anonymous fallback path (spec §2.1.1): no text-back is
 * possible for these callers, so this is a high-priority alert with the
 * recording instead of a lead conversation.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method not allowed');
  }
  if (!isSupabaseConfigured() || !isTwilioConfigured() || !isTwilioWebhookValidationConfigured()) return res.status(503).send('Not configured');
  if (!isValidTwilioRequest(req, '/api/webhooks/voice/recording')) return res.status(403).send('Invalid signature');

  const supabase = getSupabase();
  const { CallSid, RecordingUrl, RecordingDuration, From, To } = req.body;

  try {
    const { data: call } = await supabase
      .from('responder_calls')
      .select('id, account_id')
      .eq('twilio_sid', CallSid)
      .maybeSingle();

    if (call) {
      await supabase.from('responder_calls').update({
        recording_url: RecordingUrl,
        duration_sec: RecordingDuration ? Number(RecordingDuration) : null,
      }).eq('id', call.id);

      const isAnonymous = !From || From.toLowerCase() === 'anonymous';
      if (!isAnonymous) {
        const contact = await findOrCreateContact({ supabase, accountId: call.account_id, phone: From, source: 'missed_call' });
        await supabase.from('responder_calls').update({ contact_id: contact.id }).eq('id', call.id);
        await createLead({ supabase, accountId: call.account_id, contactId: contact.id, source: 'missed_call' });
      }

      const { data: config } = await supabase.from('responder_ai_configs').select('owner_alert_phone').eq('account_id', call.account_id).maybeSingle();
      if (config?.owner_alert_phone) {
        await sendSms({
          to: config.owner_alert_phone,
          body: `Voicemail left by ${isAnonymous ? 'a blocked number' : From}: ${RecordingUrl}`,
        }).catch(() => {});
      }
    }
  } catch (err) {
    console.error('[voice/recording]', err);
  }

  const twiml = new VoiceResponse();
  res.setHeader('Content-Type', 'text/xml');
  return res.status(200).send(twiml.toString());
}
