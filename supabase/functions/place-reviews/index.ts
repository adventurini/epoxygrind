// Google Places review cache — BUILD-places-reviews.md.
//
// Cost control is the entire point: the Places API (New) place-details
// call is billable (~$0.02/call). Fetching on every page view would bill
// per visitor AND per bot crawl. Instead: fetch once, cache in Postgres,
// serve from cache for TTL_DAYS. Cost scales with places viewed, not
// traffic. Never lower TTL_DAYS without a real reason.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const TTL_DAYS = 30;
const FIELD_MASK = 'id,displayName,rating,userRatingCount,googleMapsUri,reviews,photos';
const PLACES_API = 'https://places.googleapis.com/v1/places';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') || 'https://epoxygrind.vercel.app',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function getServiceClient() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );
}

function isFresh(fetchedAt: string | null) {
  if (!fetchedAt) return false;
  const ageMs = Date.now() - new Date(fetchedAt).getTime();
  return ageMs < TTL_DAYS * 24 * 60 * 60 * 1000;
}

// `data.photos[].media_url` embeds the raw Google Maps API key (it's built
// server-side for /api/places-photo, a proxy that serves the actual image
// bytes — see api/places-photo.js). This function is the only thing that
// ever sends `data` to a browser — never forward photos as-is, or the key
// leaks in plain sight in the network response. Only the attribution
// (author name + link, required by Google's display terms) is safe to
// expose; the client fetches actual photo bytes from the key-protecting
// proxy by index, never from Google directly.
function sanitizeForClient(data: any) {
  if (!data) return data;
  const { photos, ...rest } = data;
  return {
    ...rest,
    photo_attributions: (photos || []).map((p: any) => p.attributions?.[0] || null),
  };
}

function normalize(raw: any, apiKey: string) {
  const reviews = (raw.reviews || []).map((r: any) => ({
    rating: r.rating ?? null,
    text: r.text?.text || '',
    relative_time: r.relativePublishTimeDescription || '',
    publish_time: r.publishTime || null,
    author_name: r.authorAttribution?.displayName || 'Google user',
    author_uri: r.authorAttribution?.uri || null,
    author_photo_uri: r.authorAttribution?.photoUri || null,
    google_maps_uri: raw.googleMapsUri || null,
  }));

  const photos = (raw.photos || []).slice(0, 8).map((p: any) => ({
    // p.name already comes back as "places/{place_id}/photos/{ref}" — do
    // NOT prefix with PLACES_API (which already ends in "/places") or this
    // 404s with a duplicated "places/places/" path segment.
    media_url: `https://places.googleapis.com/v1/${p.name}/media?maxWidthPx=1200&key=${apiKey}`,
    width: p.widthPx || null,
    height: p.heightPx || null,
    attributions: (p.authorAttributions || []).map((a: any) => ({
      display_name: a.displayName,
      uri: a.uri,
    })),
  }));

  return {
    place_id: raw.id,
    display_name: raw.displayName?.text || '',
    rating: raw.rating ?? null,
    review_count: raw.userRatingCount ?? 0,
    google_maps_uri: raw.googleMapsUri || null,
    reviews,
    photos,
    fetched_at: new Date().toISOString(),
  };
}

async function fetchWithRetry(url: string, headers: Record<string, string>) {
  const maxAttempts = 4;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(url, { headers });
    if (res.ok) return res;
    if (res.status !== 429 && res.status < 500) return res; // fail fast on other 4xx
    const retryAfter = Number(res.headers.get('Retry-After'));
    const backoff = retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt + Math.random() * 250;
    if (attempt < maxAttempts - 1) await new Promise((r) => setTimeout(r, backoff));
  }
  return fetch(url, { headers }); // final attempt, let caller see the error
}

async function refresh(placeId: string) {
  const supabase = getServiceClient();
  const apiKey = Deno.env.get('GOOGLE_MAPS_API_KEY')!;

  const { data: claimed } = await supabase.rpc('claim_place', { pid: placeId });
  if (!claimed) return; // another request already owns this refresh

  try {
    const res = await fetchWithRetry(`${PLACES_API}/${placeId}`, {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => res.statusText);
      await supabase.from('places_cache').upsert({
        place_id: placeId,
        status: 'error',
        error: `HTTP ${res.status}: ${errText.slice(0, 500)}`,
        updated_at: new Date().toISOString(),
      });
      await supabase.rpc('bump_stat', { key: 'api_error' });
      return;
    }

    const raw = await res.json();
    const data = normalize(raw, apiKey);

    await supabase.from('places_cache').upsert({
      place_id: placeId,
      data,
      status: 'ok',
      error: null,
      fetched_at: data.fetched_at,
      updated_at: new Date().toISOString(),
    });
    await supabase.rpc('bump_stat', { key: 'api_fetch' });
  } catch (err) {
    await supabase.from('places_cache').upsert({
      place_id: placeId,
      status: 'error',
      error: String(err).slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    await supabase.rpc('bump_stat', { key: 'api_error' });
  } finally {
    await supabase.from('places_inflight').delete().eq('place_id', placeId);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const placeId = url.searchParams.get('place_id');
  if (!placeId) {
    return jsonResponse({ error: 'place_id is required' }, 400);
  }

  const supabase = getServiceClient();
  const { data: row } = await supabase
    .from('places_cache')
    .select('data, status, fetched_at')
    .eq('place_id', placeId)
    .maybeSingle();

  if (row?.status === 'ok' && row.data && isFresh(row.fetched_at)) {
    await supabase.rpc('bump_stat', { key: 'hit' });
    return jsonResponse({ status: 'fresh', data: sanitizeForClient(row.data) });
  }

  // @ts-ignore — EdgeRuntime is available in the Supabase Edge Functions runtime
  const waitUntil = typeof EdgeRuntime !== 'undefined' ? EdgeRuntime.waitUntil : (p: Promise<unknown>) => p;
  waitUntil(refresh(placeId));

  if (row?.data) {
    await supabase.rpc('bump_stat', { key: 'stale_served' });
    return jsonResponse({ status: 'stale', data: sanitizeForClient(row.data) });
  }

  await supabase.rpc('bump_stat', { key: 'miss' });
  return jsonResponse({ status: 'pending', data: null });
});
