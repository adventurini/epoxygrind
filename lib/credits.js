const FREE_CREDITS = 5;

/**
 * Atomically spends one credit for a user, creating their profile (with the
 * default free balance) on first use. Returns the credits remaining after
 * the spend, or null if the user had none left — the DB does the whole
 * check-and-decrement in one statement (see supabase/migrations), so
 * concurrent requests for the same user can't double-spend.
 */
export async function spendCredit(supabase, userId) {
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
