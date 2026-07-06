import { getSupabase, isSupabaseConfigured } from '../../lib/supabase.js';
import { parseCookies, verifyPendingClaimCookie, PENDING_CLAIM_COOKIE } from '../../lib/contractor-auth.js';

/** GET /api/contractor/pending-claim — powers the claim interstitial's
 * prefill (business name, city, a scraped email as a starting guess). */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const cookies = parseCookies(req.headers?.cookie);
  const pending = verifyPendingClaimCookie(cookies[PENDING_CLAIM_COOKIE]);
  if (!pending) {
    return res.status(401).json({ error: 'Your claim link has expired — request a new one.' });
  }

  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('contractors')
    .select('name, city, state, emails, phones')
    .eq('id', pending.contractorId)
    .maybeSingle();

  if (error || !data) return res.status(404).json({ error: 'Not found.' });

  return res.status(200).json({
    name: data.name,
    city: data.city,
    state: data.state,
    suggestedEmail: data.emails?.[0] || '',
    suggestedPhone: data.phones?.[0] || '',
  });
}
