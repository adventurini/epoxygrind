import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { verifyAuthToken, sessionCookieHeader, pendingClaimCookieHeader } from '../../lib/contractor-auth.js';

function errorPage(message) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Link problem | EpoxyGrind</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family:system-ui,sans-serif;max-width:480px;margin:80px auto;padding:0 24px;text-align:center">
<h1 style="font-size:20px">${message}</h1>
<p><a href="/services/">Request a new link</a></p>
</body></html>`;
}

/**
 * GET /claim/{token} (rewritten from vercel.json, mirrors /go/:id).
 * Resolves a claim/login/preview token and either logs the contractor
 * straight in (login, or a claim token for someone already claimed) or
 * hands off to the static claim interstitial via a short-lived cookie.
 */
export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(503).send(errorPage('This link is temporarily unavailable.'));
  }

  const token = String(req.query?.token || '');
  const result = await verifyAuthToken(token);

  res.setHeader('Content-Type', 'text/html');

  if (!result.ok) {
    const message = {
      expired: 'This link has expired.',
      already_used: 'This link has already been used.',
      not_found: "This link isn't valid.",
      missing_token: "This link isn't valid.",
    }[result.reason] || "This link isn't valid.";
    return res.status(400).send(errorPage(message));
  }

  if (result.purpose === 'preview') {
    // Phase 7 (demo reveal page) isn't built yet.
    return res.status(200).send(errorPage("This preview isn't ready yet — check back soon."));
  }

  const supabase = getSupabase();
  const { data: contractor } = await supabase
    .from('contractors')
    .select('id, claimed_at')
    .eq('id', result.contractorId)
    .maybeSingle();

  if (!contractor) {
    return res.status(400).send(errorPage("This link isn't valid."));
  }

  // A login token, or a claim token for someone who already claimed
  // (re-clicking an old email) — go straight to the dashboard.
  if (result.purpose === 'login' || contractor.claimed_at) {
    await supabase.from('contractors').update({ last_login_at: new Date().toISOString() }).eq('id', contractor.id);
    res.setHeader('Set-Cookie', sessionCookieHeader(contractor.id));
    res.writeHead(302, { Location: '/contractor/dashboard/' });
    return res.end();
  }

  // First-time claim — hand off to the interstitial (confirm email, phone,
  // SMS consent) via a short-lived cookie rather than exposing the raw
  // claim token in a query string.
  res.setHeader('Set-Cookie', pendingClaimCookieHeader(contractor.id));
  res.writeHead(302, { Location: '/contractor/claim/' });
  return res.end();
}
