import { getUserFromRequest } from './auth-request.js';
import { getSupabase } from './supabase.js';

/**
 * Verifies the request's bearer token belongs to a signed-in user AND that
 * user's profiles.is_admin flag is true. Returns null (never throws) so
 * callers can respond with a uniform 401/403 rather than leaking whether
 * the failure was "not signed in" vs "not admin".
 */
export async function requireAdmin(req) {
  const auth = await getUserFromRequest(req);
  if (!auth) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error || !data?.is_admin) return null;
  return auth;
}
