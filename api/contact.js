import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contact — the general contact form at the bottom of the
 * homepage. Public (anonymous), so the honeypot field is the primary spam
 * defense — same pattern as api/contractor-lead.js.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Contact form is not configured.' });
  }

  const body = req.body || {};

  if (String(body.company_website || '').trim()) {
    return res.status(200).json({ ok: true });
  }

  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const message = String(body.message || '').trim().slice(0, 2000);
  const sourcePath = String(body.sourcePath || '').trim().slice(0, 300);

  if (!name || !email || !EMAIL_RE.test(email) || !message) {
    return res.status(400).json({ error: 'Name, email, and a message are required.' });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('contact_messages').insert({
      name,
      email,
      message,
      source_path: sourcePath || null,
    });
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contact insert failed:', err.message);
    return res.status(500).json({ error: 'Could not submit — please try again.' });
  }
}
