import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { METROS } from '../lib/metros.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const ZIP_CENTROIDS = JSON.parse(readFileSync(join(ROOT, '..', 'content', 'data', 'zip-centroids.json'), 'utf8'));

const EARTH_RADIUS_MI = 3958.8;

function haversineMiles(lat1, lon1, lat2, lon2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_MI * 2 * Math.asin(Math.sqrt(a));
}

/**
 * GET /api/nearest-metro?zip=90210 -> the closest metro (straight-line
 * distance) to that ZIP's centroid, from the free US Census Gazetteer ZCTA
 * dataset (content/data/zip-centroids.json, ~33.8k ZIPs).
 */
export default function handler(req, res) {
  const zip = String(req.query?.zip || '').trim().slice(0, 5);
  if (!/^\d{5}$/.test(zip)) {
    return res.status(400).json({ error: 'A 5-digit ZIP code is required.' });
  }

  const centroid = ZIP_CENTROIDS[zip];
  if (!centroid) {
    return res.status(404).json({ error: 'ZIP code not found.' });
  }
  const [lat, lon] = centroid;

  let nearest = null;
  let nearestDist = Infinity;
  for (const metro of METROS) {
    const dist = haversineMiles(lat, lon, metro.lat, metro.lon);
    if (dist < nearestDist) {
      nearestDist = dist;
      nearest = metro;
    }
  }

  if (!nearest) return res.status(404).json({ error: 'No metro found.' });

  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.status(200).json({
    state_slug: nearest.state_slug,
    slug: nearest.slug,
    city: nearest.city,
    state: nearest.state,
    distance_mi: Math.round(nearestDist),
  });
}
