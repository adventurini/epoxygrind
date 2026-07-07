import { isSupabaseConfigured, getSupabase } from '../../lib/supabase.js';
import { getContractorFromRequest } from '../../lib/contractor-auth.js';
import { CONTRACTORS } from '../../lib/contractors.js';

const SERVICE_KEYS = new Set([
  'epoxy_flake', 'epoxy_solid', 'metallic_epoxy', 'polyaspartic', 'polyurea',
  'concrete_polish', 'concrete_stain', 'concrete_repair', 'commercial', 'residential',
  'countertops', 'pool_deck',
]);
const SOCIAL_KEYS = new Set(['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'tiktok']);
const TRUST_BOOL_KEYS = new Set(['licensed', 'insured', 'warranty', 'free_estimates', 'financing', 'family_owned']);

function cleanStringArray(value, { maxLen = 200, maxItems = 30 } = {}) {
  if (!Array.isArray(value)) return null;
  return value.map((v) => String(v).trim().slice(0, maxLen)).filter(Boolean).slice(0, maxItems);
}

function cleanServices(value) {
  const arr = cleanStringArray(value);
  if (!arr) return null;
  return arr.filter((v) => SERVICE_KEYS.has(v));
}

function cleanSocials(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of SOCIAL_KEYS) {
    if (typeof value[key] === 'string' && value[key].trim()) out[key] = value[key].trim().slice(0, 300);
  }
  return out;
}

function cleanTrustSignals(value) {
  if (!value || typeof value !== 'object') return null;
  const out = {};
  for (const key of TRUST_BOOL_KEYS) out[key] = Boolean(value[key]);
  const years = Number(value.years_in_business);
  if (Number.isFinite(years) && years >= 0 && years <= 150) out.years_in_business = Math.round(years);
  return out;
}

function toResponse(contractor) {
  const listing = contractor.place_id ? CONTRACTORS.find((c) => c.place_id === contractor.place_id) : null;
  return {
    id: contractor.id,
    name: contractor.name,
    website: contractor.website,
    city: contractor.city,
    state: contractor.state,
    phones: contractor.phones || [],
    services: contractor.services || [],
    serviceAreas: contractor.service_areas || [],
    trustSignals: contractor.trust_signals || {},
    socials: contractor.socials || {},
    contactEmail: contractor.contact_email,
    contactPhone: contractor.contact_phone,
    claimedAt: contractor.claimed_at,
    listingUrl: listing ? `/contractors/${listing.state_slug}/${listing.slug}/` : null,
  };
}

/**
 * GET/PATCH /api/contractor/profile — the claimed contractor's full,
 * editable listing. Fields here are exactly the ones lib/contractor-
 * templates.js reads to render the public listing page (name, phones,
 * services, service_areas, trust_signals, socials) — deliberately NOT
 * photos, which come from build-time manifests (lib/contractor-images.js),
 * not this table, and aren't editable through this endpoint.
 */
export default async function handler(req, res) {
  if (!isSupabaseConfigured()) {
    return res.status(503).json({ error: 'Not configured.' });
  }

  const contractor = await getContractorFromRequest(req);
  if (!contractor) return res.status(401).json({ error: 'Not signed in.' });

  const supabase = getSupabase();

  if (req.method === 'GET') {
    return res.status(200).json(toResponse(contractor));
  }

  if (req.method === 'PATCH') {
    const body = req.body || {};
    const update = {};

    if (typeof body.name === 'string' && body.name.trim()) update.name = body.name.trim().slice(0, 200);
    if (typeof body.website === 'string') update.website = body.website.trim().slice(0, 500) || null;
    if (body.phones !== undefined) {
      const phones = cleanStringArray(body.phones, { maxLen: 40, maxItems: 5 });
      if (phones) update.phones = phones;
    }
    if (body.services !== undefined) {
      const services = cleanServices(body.services);
      if (services) update.services = services;
    }
    if (body.serviceAreas !== undefined) {
      const areas = cleanStringArray(body.serviceAreas, { maxLen: 100, maxItems: 50 });
      if (areas) update.service_areas = areas;
    }
    if (body.trustSignals !== undefined) {
      const trust = cleanTrustSignals(body.trustSignals);
      if (trust) update.trust_signals = trust;
    }
    if (body.socials !== undefined) {
      const socials = cleanSocials(body.socials);
      if (socials) update.socials = socials;
    }

    if (!Object.keys(update).length) {
      return res.status(400).json({ error: 'No valid fields to update.' });
    }
    update.updated_at = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('contractors')
      .update(update)
      .eq('id', contractor.id)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: 'Could not save changes — please try again.' });

    return res.status(200).json(toResponse(updated));
  }

  res.setHeader('Allow', 'GET, PATCH');
  return res.status(405).json({ error: 'Method not allowed' });
}
