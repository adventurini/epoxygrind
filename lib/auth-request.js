import { createClient } from '@supabase/supabase-js';

export async function getUserFromRequest(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header?.startsWith('Bearer ')) return null;

  const token = header.slice(7);
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: { user }, error } = await client.auth.getUser(token);
  if (error || !user) return null;
  return { user, token };
}
