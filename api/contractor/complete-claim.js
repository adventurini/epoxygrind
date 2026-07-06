import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import {
  parseCookies,
  verifyPendingClaimCookie,
  sessionCookieHeader,
  clearPendingClaimCookieHeader,
  PENDING_CLAIM_COOKIE,
} from '../../lib/contractor-auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contractor/complete-claim { contactEmail, phone, smsConsent }
 * The claim interstitial's submit handler — reads which contractor via the
 * short-lived pending-claim cookie set by /claim/{token}, never a token in
 * the request body, so this can't be replayed against an arbitrary contractor.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const cookies = parseCookies(req.headers?.cookie);
  const pending = verifyPendingClaimCookie(cookies[PENDING_CLAIM_COOKIE]);
  if (!pending) {
    return res.status(401).json({ error: 'Your claim link has expired — request a new one.' });
  }

  const contactEmail = String(req.body?.contactEmail || '').trim().toLowerCase();
  const phone = String(req.body?.phone || '').trim().slice(0, 40);
  const smsConsent = Boolean(req.body?.smsConsent);

  if (!contactEmail || !EMAIL_RE.test(contactEmail)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }
  if (!phone) {
    return res.status(400).json({ error: 'A phone number is required — this is where leads get routed.' });
  }

  try {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('contractors')
      .update({
        contact_email: contactEmail,
        email_verified_at: now,
        contact_phone: phone,
        claimed_at: now,
        last_login_at: now,
        sms_consent_at: smsConsent ? now : null,
      })
      .eq('id', pending.contractorId);

    if (error) throw error;

    res.setHeader('Set-Cookie', [sessionCookieHeader(pending.contractorId), clearPendingClaimCookieHeader()]);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('complete-claim failed:', err.message);
    return res.status(500).json({ error: 'Could not complete claim — please try again.' });
  }
}
