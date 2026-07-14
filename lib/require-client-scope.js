import { getUserFromRequest } from './auth-request.js';
import { getSupabase } from './supabase.js';

/**
 * Verifies the request's bearer token belongs to a signed-in user whose
 * profiles.client_scope matches the expected scope. Distinct from
 * requireAdmin (lib/require-admin.js) — this is a much narrower grant, for
 * client-site admin panels that should only ever see their own tagged
 * data, never the rest of EpoxyGrind's admin surface. Returns null (never
 * throws) so callers can respond with a uniform 401/403.
 * @param {*} req
 * @param {string} expectedScope - e.g. 'mirrorball-epoxy'
 */
export async function requireClientScope(req, expectedScope) {
  const auth = await getUserFromRequest(req);
  if (!auth) return null;

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('profiles')
    .select('client_scope, is_admin')
    .eq('user_id', auth.user.id)
    .maybeSingle();

  if (error || !data) return null;
  // A full admin can also view any client scope (useful for us to verify
  // exactly what the client sees), but a client-scoped user can only ever
  // match their own exact scope.
  if (data.is_admin) return auth;
  if (data.client_scope === expectedScope) return auth;
  return null;
}
