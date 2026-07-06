const RESEND_API = 'https://api.resend.com/emails';

// Sending domain isn't verified yet (epoxygrind.com is already registered
// to a different Resend account than this API key's — needs the account
// owner to resolve before real delivery works). Resend will still accept
// the API call and, once a domain IS verified, this is the only line that
// needs to change.
const FROM_ADDRESS = 'EpoxyGrind <onboarding@resend.dev>';

export function isResendConfigured() {
  return Boolean(process.env.RESEND_API_KEY);
}

/** @returns {Promise<{ok: boolean, id?: string, error?: string}>} */
export async function sendEmail({ to, subject, html, from = FROM_ADDRESS }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: 'RESEND_API_KEY is not configured.' };

  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to, subject, html }),
    });

    const data = await res.json();
    if (!res.ok) return { ok: false, error: data?.message || `Resend ${res.status}` };
    return { ok: true, id: data.id };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
