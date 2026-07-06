import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { createAuthToken } from '../../lib/contractor-auth.js';
import { sendEmail, isResendConfigured } from '../../lib/resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = 'https://epoxygrind.com';

function claimEmailHtml(contractor, link) {
  return `<p>Hi ${contractor.name},</p>
<p>Confirm your business email and claim your EpoxyGrind listing:</p>
<p><a href="${link}">${link}</a></p>
<p>This link is valid for 30 days.</p>`;
}

function loginEmailHtml(contractor, link) {
  return `<p>Hi ${contractor.name},</p>
<p>Here's your EpoxyGrind dashboard login link:</p>
<p><a href="${link}">${link}</a></p>
<p>This link is valid for 24 hours and can only be used once.</p>`;
}

/**
 * POST /api/contractor/request-link { email }
 * Public (no auth) — a contractor types the email their listing was found
 * under, or the contact email they claimed with. Always returns the same
 * generic success message regardless of whether the email matched
 * anything, so this can't be used to enumerate which businesses are in the
 * database (spec: "Unknown email = 'We'll be in touch' + manual-review flag").
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const email = String(req.body?.email || '').trim().toLowerCase();
  const GENERIC_OK = { ok: true, message: "If we found a match, we'll be in touch shortly." };

  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A valid email is required.' });
  }

  try {
    const supabase = getSupabase();

    let { data: contractor } = await supabase
      .from('contractors')
      .select('id, name, contact_email, claimed_at, emails')
      .eq('contact_email', email)
      .maybeSingle();

    if (!contractor) {
      // Pre-claim match: scraped `emails` is a jsonb array, usually stored
      // as originally found (case varies) — try exact, then a case-
      // insensitive scan as a fallback rather than missing real matches.
      const exact = await supabase.from('contractors').select('id, name, contact_email, claimed_at, emails').contains('emails', [email]);
      contractor = exact.data?.[0];

      if (!contractor) {
        const candidates = await supabase.from('contractors').select('id, name, contact_email, claimed_at, emails').not('emails', 'eq', '[]');
        contractor = (candidates.data || []).find((c) => (c.emails || []).some((e) => String(e).toLowerCase() === email));
      }
    }

    if (!contractor) {
      console.log(`[contractor claim] no match for ${email} — flagged for manual review`);
      return res.status(200).json(GENERIC_OK);
    }

    const purpose = contractor.claimed_at ? 'login' : 'claim';
    const rawToken = await createAuthToken(contractor.id, purpose);
    const link = `${SITE_URL}/claim/${rawToken}`;

    if (isResendConfigured()) {
      const sent = await sendEmail({
        to: email,
        subject: purpose === 'claim' ? 'Claim your EpoxyGrind listing' : 'Your EpoxyGrind login link',
        html: purpose === 'claim' ? claimEmailHtml(contractor, link) : loginEmailHtml(contractor, link),
      });
      if (!sent.ok) console.error(`[contractor claim] Resend send failed: ${sent.error}`);
    } else {
      console.error('[contractor claim] RESEND_API_KEY not configured — cannot send link email.');
    }

    // Dev/ops aid until the sending domain is verified and delivery is
    // confirmed end-to-end — remove once real email delivery is proven.
    console.log(`[contractor claim] ${purpose} link for contractor ${contractor.id} (${contractor.name}): ${link}`);

    return res.status(200).json(GENERIC_OK);
  } catch (err) {
    console.error('request-link failed:', err.message);
    return res.status(200).json(GENERIC_OK);
  }
}
