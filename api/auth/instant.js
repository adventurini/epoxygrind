import { createInstantSession } from '../../lib/instant-auth.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Auth is not configured.' });
  }

  const email = String(req.body?.email || '').trim();
  const name = String(req.body?.name || req.body?.fullName || '').trim();

  try {
    const supabase = getSupabase();
    const session = await createInstantSession(supabase, email, name);
    return res.status(200).json({
      email: session.email,
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Could not start session.' });
  }
}
