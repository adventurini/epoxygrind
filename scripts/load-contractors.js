#!/usr/bin/env node
/**
 * Loads content/data/enriched.json (scripts/enrich-contractors.py output)
 * into the Supabase `contractors` table (BUILD-everything.md step 3).
 * Upserts on place_id where present; contractors without a place_id are
 * inserted plain (no natural dedup key available from discovery).
 *
 * Run with: node scripts/load-contractors.js
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const path = join(ROOT, '.env.local');
  const text = readFileSync(path, 'utf8');
  for (const line of text.split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) process.env[match[1]] = process.env[match[1]] || match[2];
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set (check .env.local)');
}

function toRow(c) {
  return {
    place_id: c.place_id || null,
    name: c.name,
    website: c.website || null,
    city: c.city || null,
    state: c.state || null,
    phones: c.phones || [],
    emails: c.emails || [],
    services: c.services || [],
    raw_services: c.raw_services || [],
    service_areas: c.service_areas || [],
    trust_signals: c.trust_signals || {},
    socials: c.socials || {},
    has_photo_gallery: Boolean(c.has_photo_gallery),
    has_contact_form: Boolean(c.has_contact_form),
    title: c.title || null,
    meta_description: c.meta_description || null,
    status: c.status || 'ok',
    updated_at: new Date().toISOString(),
  };
}

async function upsertBatch(rows, withPlaceId) {
  const url = `${SUPABASE_URL}/rest/v1/contractors${withPlaceId ? '?on_conflict=place_id' : ''}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: withPlaceId ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upsert failed (${res.status}): ${text.slice(0, 500)}`);
  }
}

async function main() {
  const enriched = JSON.parse(readFileSync(join(ROOT, 'content', 'data', 'enriched.json'), 'utf8'));
  console.log(`Loaded ${enriched.length} contractors from enriched.json`);

  const rows = enriched.map(toRow);
  const withPlaceId = rows.filter((r) => r.place_id);
  const withoutPlaceId = rows.filter((r) => !r.place_id);

  const BATCH_SIZE = 200;
  let done = 0;

  for (let i = 0; i < withPlaceId.length; i += BATCH_SIZE) {
    const batch = withPlaceId.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch, true);
    done += batch.length;
    console.log(`  upserted ${done}/${withPlaceId.length} (place_id rows)`);
  }

  if (withoutPlaceId.length) {
    console.log(`\n${withoutPlaceId.length} rows have no place_id — checking for existing name+city+state matches before inserting...`);
    for (let i = 0; i < withoutPlaceId.length; i += BATCH_SIZE) {
      const batch = withoutPlaceId.slice(i, i + BATCH_SIZE);
      await upsertBatch(batch, false);
      console.log(`  inserted ${Math.min(i + BATCH_SIZE, withoutPlaceId.length)}/${withoutPlaceId.length} (no-place_id rows)`);
    }
  }

  const countRes = await fetch(`${SUPABASE_URL}/rest/v1/contractors?select=id`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Prefer: 'count=exact', Range: '0-0' },
  });
  const range = countRes.headers.get('content-range');
  console.log(`\nDone. Table row count (content-range): ${range}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
