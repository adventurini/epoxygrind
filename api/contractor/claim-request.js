import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { createAuthToken } from '../../lib/contractor-auth.js';
import { sendEmail, isResendConfigured } from '../../lib/resend.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SITE_URL = 'https://epoxygrind.com';

function hostnameOf(url) {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

function claimEmailHtml(contractor, link) {
  return `<p>Hi ${contractor.name},</p>
<p>Confirm your business email and claim your EpoxyGrind listing:</p>
<p><a href="${link}">${link}</a></p>
<p>This link is valid for 30 days.</p>`;
}

/**
 * POST /api/contractor/claim-request { placeId, email, name } — public
 * (no auth). Scoped to one specific listing (unlike the generic email
 * lookup in request-link.js), since it's submitted from that listing's own
 * public page. Auto-verifies via two paths — the submitted email's domain
 * matches the listing's website domain, or the email matches contact_email
 * / the scraped emails[] on file — and only sends a real claim link for
 * those. Anything else is logged to claim_requests for manual follow-up
 * instead of silently failing.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const placeId = String(req.body?.placeId || '').trim();
  const email = String(req.body?.email || '').trim().toLowerCase();
  const name = String(req.body?.name || '').trim().slice(0, 200);

  if (!placeId) return res.status(400).json({ error: 'Missing listing reference.' });
  if (!email || !EMAIL_RE.test(email)) return res.status(400).json({ error: 'A valid email is required.' });

  const supabase = getSupabase();

  try {
    const { data: contractor, error: lookupErr } = await supabase
      .from('contractors')
      .select('id, name, website, contact_email, emails, claimed_at')
      .eq('place_id', placeId)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!contractor) return res.status(404).json({ error: "Couldn't find that listing." });

    if (contractor.claimed_at) {
      return res.status(200).json({
        ok: true,
        alreadyClaimed: true,
        message: 'This listing has already been claimed. If this is your business, use the login link instead.',
      });
    }

    const emailDomain = email.split('@')[1];
    const siteDomain = hostnameOf(contractor.website);
    const domainMatch = Boolean(siteDomain && emailDomain === siteDomain);
    const onFileMatch =
      (contractor.contact_email && contractor.contact_email.toLowerCase() === email) ||
      (contractor.emails || []).some((e) => String(e).toLowerCase() === email);

    const matchType = domainMatch ? 'domain' : onFileMatch ? 'email_on_file' : 'none';

    await supabase.from('claim_requests').insert({
      contractor_id: contractor.id,
      email,
      name: name || null,
      match_type: matchType,
      status: matchType === 'none' ? 'pending_review' : 'auto_sent',
    });

    if (matchType === 'none') {
      return res.status(200).json({
        ok: true,
        message: "We couldn't automatically verify that email against this listing — we'll follow up to confirm manually, usually within one business day.",
      });
    }

    const rawToken = await createAuthToken(contractor.id, 'claim');
    const link = `${SITE_URL}/claim/${rawToken}`;

    if (isResendConfigured()) {
      const sent = await sendEmail({
        to: email,
        subject: 'Claim your EpoxyGrind listing',
        html: claimEmailHtml(contractor, link),
      });
      if (!sent.ok) console.error(`[claim-request] Resend send failed: ${sent.error}`);
    } else {
      console.error('[claim-request] RESEND_API_KEY not configured — cannot send link email.');
    }
    console.log(`[claim-request] ${matchType} match — claim link for contractor ${contractor.id} (${contractor.name}): ${link}`);

    return res.status(200).json({ ok: true, message: "Check your email — we've sent a link to confirm and claim this listing." });
  } catch (err) {
    console.error('claim-request failed:', err.message);
    return res.status(500).json({ error: 'Something went wrong — please try again.' });
  }
}
