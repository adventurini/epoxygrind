export default function handler(_req, res) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ error: 'Auth is not configured.' });
  }

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ supabaseUrl, supabaseAnonKey });
}
