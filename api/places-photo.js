import { getSupabase, isSupabaseConfigured } from '../lib/supabase.js';

const PLACES_API = 'https://places.googleapis.com/v1/places';
const FIELD_MASK = 'id,photos';
const TTL_DAYS = 30;
const FALLBACK_IMAGE = '/images/og-generic.jpg';

/**
 * GET /api/places-photo?place_id=X&index=0
 *
 * Server-side proxy for a Google Place photo — the browser only ever sees
 * this URL, never the raw GOOGLE_MAPS_API_KEY or a Google-hosted URL.
 * Reads/writes the same `places_cache` table the place-reviews Edge
 * Function already uses (same 30-day TTL convention), so this never costs
 * an extra Places API call beyond what reviews already trigger — photos
 * ride along in the same cached payload.
 *
 * Replaces rehosting Google photos to Supabase Storage (a Places API ToS
 * violation — Place content besides place_id/lat-lng cannot be stored).
 */
export default async function handler(req, res) {
  const placeId = String(req.query?.place_id || '');
  const index = Math.max(0, Number(req.query?.index) || 0);

  if (!placeId || !isSupabaseConfigured()) {
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, FALLBACK_IMAGE);
  }

  try {
    const supabase = getSupabase();
    let { data: row } = await supabase
      .from('places_cache')
      .select('data, status, fetched_at')
      .eq('place_id', placeId)
      .maybeSingle();

    const isStale = !row?.fetched_at || Date.now() - new Date(row.fetched_at).getTime() > TTL_DAYS * 24 * 60 * 60 * 1000;

    if ((!row?.data?.photos?.length || isStale) && process.env.GOOGLE_MAPS_API_KEY) {
      const refreshed = await refreshPhotos(placeId, supabase, row?.data);
      if (refreshed) row = { data: refreshed };
    }

    const photo = row?.data?.photos?.[index];
    if (!photo?.media_url) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, FALLBACK_IMAGE);
    }

    const imgRes = await fetch(photo.media_url);
    if (!imgRes.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.redirect(302, FALLBACK_IMAGE);
    }

    const buf = Buffer.from(await imgRes.arrayBuffer());
    res.setHeader('Content-Type', imgRes.headers.get('content-type') || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    return res.status(200).send(buf);
  } catch (err) {
    console.error('places-photo failed:', err.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.redirect(302, FALLBACK_IMAGE);
  }
}

/**
 * Minimal, Node-side twin of supabase/functions/place-reviews' refresh() —
 * duplicated rather than shared because one runs on Deno (Edge Functions)
 * and one on Vercel's Node runtime. Only fetches the `photos` field (not
 * rating/reviews, already covered by place-reviews) to keep the call cheap.
 */
async function refreshPhotos(placeId, supabase, existingData) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const res = await fetch(`${PLACES_API}/${placeId}`, {
    headers: { 'X-Goog-Api-Key': apiKey, 'X-Goog-FieldMask': FIELD_MASK },
  });
  if (!res.ok) return null;

  const raw = await res.json();
  const photos = (raw.photos || []).slice(0, 8).map((p) => ({
    name: p.name,
    media_url: `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&key=${apiKey}`,
    width: p.widthPx || null,
    height: p.heightPx || null,
    attributions: (p.authorAttributions || []).map((a) => ({ display_name: a.displayName, uri: a.uri })),
  }));

  const merged = { ...existingData, photos, fetched_at: new Date().toISOString() };
  await supabase.from('places_cache').upsert({
    place_id: placeId,
    data: merged,
    status: 'ok',
    error: null,
    fetched_at: merged.fetched_at,
    updated_at: new Date().toISOString(),
  });
  return merged;
}
