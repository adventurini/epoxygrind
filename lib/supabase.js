import { createClient } from '@supabase/supabase-js';

let client;

export function getSupabase() {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) return null;

  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client;
}

export function isSupabaseConfigured() {
  return Boolean(process.env.SUPABASE_URL && (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY));
}

/**
 * A fresh, uncached client. `supabase.auth.verifyOtp` (and other non-admin
 * auth calls) mutate a client's session in place, which would silently
 * switch the shared getSupabase() client from the service role to whatever
 * user just signed in — then RLS blocks it on every table query after that.
 * Use this for any call that establishes a user session so the shared
 * service-role client is never touched.
 */
export function createEphemeralServiceClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
