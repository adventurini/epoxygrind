import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '15mb',
    },
  },
};

export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({
      error: 'Supabase is not configured. Set SUPABASE_URL and SUPABASE_SECRET_KEY on Vercel.',
    });
  }

  const supabase = getSupabase();

  if (req.method === 'POST') {
    try {
      const { payload, customerName, projectName } = req.body || {};
      if (!payload || typeof payload !== 'object') {
        return res.status(400).json({ error: 'Estimate payload is required.' });
      }

      const { data, error } = await supabase
        .from('estimates')
        .insert({
          customer_name: customerName || null,
          project_name: projectName || null,
          payload,
        })
        .select('id, created_at')
        .single();

      if (error) throw error;

      return res.status(201).json({ id: data.id, createdAt: data.created_at });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to save estimate.' });
    }
  }

  if (req.method === 'GET') {
    const id = req.query?.id;
    if (!id || typeof id !== 'string') {
      return res.status(400).json({ error: 'Estimate id is required.' });
    }

    try {
      const { data, error } = await supabase
        .from('estimates')
        .select('id, created_at, customer_name, project_name, payload')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      if (!data) return res.status(404).json({ error: 'Estimate not found.' });

      return res.status(200).json({
        id: data.id,
        createdAt: data.created_at,
        customerName: data.customer_name,
        projectName: data.project_name,
        ...data.payload,
      });
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: err.message || 'Failed to load estimate.' });
    }
  }

  res.setHeader('Allow', 'GET, POST');
  return res.status(405).json({ error: 'Method not allowed' });
}
