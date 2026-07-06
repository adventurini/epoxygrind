import { isSupabaseConfigured } from '../../lib/supabase.js';
import { getContractorFromRequest } from '../../lib/contractor-auth.js';

/** GET /api/contractor/me — the dashboard's identity check, mirrors the
 * homeowner side's session-based /api pattern but for the contractor cookie. */
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const contractor = await getContractorFromRequest(req);
  if (!contractor) return res.status(401).json({ error: 'Not signed in.' });

  return res.status(200).json({
    id: contractor.id,
    name: contractor.name,
    city: contractor.city,
    state: contractor.state,
    contactEmail: contractor.contact_email,
    contactPhone: contractor.contact_phone,
    claimedAt: contractor.claimed_at,
    website: contractor.website,
  });
}
