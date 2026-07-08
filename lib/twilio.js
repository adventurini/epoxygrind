import twilioPkg from 'twilio';

const { validateRequest } = twilioPkg;
const SITE_URL = 'https://www.epoxygrind.com';

export function isTwilioConfigured() {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

let cachedClient = null;
export function getTwilioClient() {
  if (!isTwilioConfigured()) return null;
  if (!cachedClient) cachedClient = twilioPkg(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  return cachedClient;
}

/**
 * Verifies the X-Twilio-Signature header against the exact webhook URL +
 * form params — webhooks are public URLs, so an unvalidated request could
 * be spoofed to fake calls/messages/leads. Uses a hardcoded canonical
 * origin (matching this repo's SITE_URL convention elsewhere) rather than
 * trusting the Host header, which a request could forge.
 * @param {import('http').IncomingMessage & { body: Record<string, string> }} req
 * @param {string} path e.g. '/api/webhooks/voice/inbound'
 */
export function isValidTwilioRequest(req, path) {
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (!authToken) return false;
  const signature = req.headers['x-twilio-signature'];
  if (!signature) return false;
  const url = `${SITE_URL}${path}`;
  return validateRequest(authToken, signature, url, req.body || {});
}

/**
 * Twilio Lookup v2 line_type_intelligence — distinguishes mobile (can
 * text) from landline/VoIP-fixed (can't), so the voice webhook can route
 * un-textable callers to the <Record> fallback instead of attempting (and
 * silently failing) a text-back (spec §2.1.1).
 * @returns {Promise<'mobile'|'landline'|'voip'|'unknown'>}
 */
export async function lookupLineType(phoneE164) {
  const client = getTwilioClient();
  if (!client) return 'unknown';
  try {
    const result = await client.lookups.v2.phoneNumbers(phoneE164).fetch({ fields: 'line_type_intelligence' });
    const type = result.lineTypeIntelligence?.type;
    if (type === 'mobile') return 'mobile';
    if (type === 'landline') return 'landline';
    if (type === 'voip') return 'voip';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/**
 * @param {{ to: string, body: string, from?: string }} opts
 */
export async function sendSms({ to, body, from }) {
  const client = getTwilioClient();
  if (!client) throw new Error('Twilio is not configured.');
  const fromNumber = from || process.env.TWILIO_NUMBER;
  if (!fromNumber) throw new Error('No Twilio sending number configured.');
  return client.messages.create({ to, from: fromNumber, body });
}

export { SITE_URL };
