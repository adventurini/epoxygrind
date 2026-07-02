import { requireAdmin } from '../../lib/require-admin.js';
import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';

function isVerified(user) {
  if (user.user_metadata?.email_verified === true) return true;
  if (user.user_metadata?.instant_demo === true) return false;
  return Boolean(user.email_confirmed_at);
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Supabase is not configured.' });
  }

  const auth = await requireAdmin(req);
  if (!auth) return res.status(403).json({ error: 'Admin access required.' });

  try {
    const supabase = getSupabase();

    const { data: userPage, error: usersError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) throw usersError;

    const [{ data: profiles, error: profilesError }, { data: estimateRows, error: estimatesError }] = await Promise.all([
      supabase.from('profiles').select('user_id, credits_remaining, is_admin'),
      supabase.from('estimates').select('user_id, created_at'),
    ]);
    if (profilesError) throw profilesError;
    if (estimatesError) throw estimatesError;

    const profileByUser = new Map((profiles || []).map((p) => [p.user_id, p]));
    const estimateCountByUser = new Map();
    const lastEstimateByUser = new Map();
    for (const row of estimateRows || []) {
      if (!row.user_id) continue;
      estimateCountByUser.set(row.user_id, (estimateCountByUser.get(row.user_id) || 0) + 1);
      const prev = lastEstimateByUser.get(row.user_id);
      if (!prev || row.created_at > prev) lastEstimateByUser.set(row.user_id, row.created_at);
    }

    const users = (userPage?.users || [])
      .map((u) => {
        const profile = profileByUser.get(u.id);
        return {
          id: u.id,
          email: u.email,
          name: u.user_metadata?.full_name || u.user_metadata?.name || null,
          createdAt: u.created_at,
          lastSignInAt: u.last_sign_in_at,
          emailVerified: isVerified(u),
          isInstantDemo: u.user_metadata?.instant_demo === true,
          isAdmin: profile?.is_admin === true,
          creditsRemaining: profile?.credits_remaining ?? null,
          estimateCount: estimateCountByUser.get(u.id) || 0,
          lastEstimateAt: lastEstimateByUser.get(u.id) || null,
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.status(200).json({ users });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || 'Failed to load users.' });
  }
}
