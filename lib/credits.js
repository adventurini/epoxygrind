const FREE_CREDITS = 5;

// Temporary: the 5-free-estimate limit is off for everyone while the
// visualizer is still being tested/iterated on — real users shouldn't be
// blocked mid-testing by a credit wall. Flip this back to false (or remove
// it) once ready to re-enable the limit for non-admins; admins are always
// unlimited regardless of this flag (see the is_admin check below).
const CREDITS_UNLIMITED_FOR_ALL = true;

/**
 * Atomically spends one credit for a user, creating their profile (with the
 * default free balance) on first use. Returns the credits remaining after
 * the spend, or null if the user had none left — the DB does the whole
 * check-and-decrement in one statement (see supabase/migrations), so
 * concurrent requests for the same user can't double-spend.
 *
 * Admins (profiles.is_admin) and, temporarily, everyone (see
 * CREDITS_UNLIMITED_FOR_ALL above) skip the spend entirely — no RPC call,
 * no row written, unlimited estimates.
 */
export async function spendCredit(supabase, userId) {
  if (CREDITS_UNLIMITED_FOR_ALL) {
    return { ok: true, creditsRemaining: null };
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .maybeSingle();
  if (profile?.is_admin) {
    return { ok: true, creditsRemaining: null };
  }

  const { data, error } = await supabase.rpc('spend_credit', { p_user_id: userId });
  if (error) throw error;
  return { ok: data !== null, creditsRemaining: data };
}

export async function getCredits(supabase, userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('credits_remaining')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data?.credits_remaining ?? FREE_CREDITS;
}
