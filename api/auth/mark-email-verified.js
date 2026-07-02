import { getUserFromRequest } from '../../lib/auth-request.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Auth is not configured.' });
  }

  const auth = await getUserFromRequest(req);
  if (!auth?.user) {
    return res.status(401).json({ error: 'Sign in required.' });
  }

  if (!auth.user.email_confirmed_at) {
    return res.status(400).json({ error: 'Email is not confirmed yet.' });
  }

  const supabase = getSupabase();
  const meta = auth.user.user_metadata || {};

  const { error } = await supabase.auth.admin.updateUserById(auth.user.id, {
    user_metadata: {
      ...meta,
      email_verified: true,
      instant_demo: false,
    },
  });

  if (error) {
    console.error(error);
    return res.status(500).json({ error: 'Could not update profile.' });
  }

  return res.status(200).json({ ok: true });
}
