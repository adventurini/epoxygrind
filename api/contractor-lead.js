import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/contractor-lead — the form at the bottom of every contractor
 * profile page. Public (no auth — anonymous site visitors submit this),
 * so the honeypot field is the primary spam defense: a hidden field real
 * users never see or fill; if it arrives non-empty, this is a bot. We
 * return a normal-looking success response either way so a bot can't tell
 * its submission was silently dropped.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Lead capture is not configured.' });
  }

  const body = req.body || {};

  // Honeypot: a hidden field named to look plausible to a bot's autofill
  // heuristics. Real users never see or fill it (CSS-hidden). Any value
  // here means a bot filled every visible-looking field — drop silently.
  if (String(body.company_website || '').trim()) {
    return res.status(200).json({ ok: true });
  }

  const name = String(body.name || '').trim().slice(0, 200);
  const email = String(body.email || '').trim().slice(0, 200);
  const phone = String(body.phone || '').trim().slice(0, 40);
  const message = String(body.message || '').trim().slice(0, 2000);
  const contractorStateSlug = String(body.contractorStateSlug || '').trim().slice(0, 100);
  const contractorSlug = String(body.contractorSlug || '').trim().slice(0, 200);
  const contractorName = String(body.contractorName || '').trim().slice(0, 200);
  const sourcePath = String(body.sourcePath || '').trim().slice(0, 300);

  if (!name || !email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'A name and valid email are required.' });
  }
  if (!contractorStateSlug || !contractorSlug || !sourcePath) {
    return res.status(400).json({ error: 'Missing page context.' });
  }

  try {
    const supabase = getSupabase();
    const { error } = await supabase.from('contractor_leads').insert({
      contractor_state_slug: contractorStateSlug,
      contractor_slug: contractorSlug,
      contractor_name: contractorName,
      source_path: sourcePath,
      name,
      email,
      phone: phone || null,
      message: message || null,
    });
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('contractor-lead insert failed:', err.message);
    return res.status(500).json({ error: 'Could not submit — please try again.' });
  }
}
