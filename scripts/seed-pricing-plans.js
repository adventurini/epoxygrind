#!/usr/bin/env node
/**
 * Seeds/updates the `plans` table from content/data/pricing-plans.js — the
 * canonical ladder is the JS file (readable at build time with no network
 * call for the static /services/ page); this just mirrors it into Supabase
 * so a future dashboard/reveal view can read current pricing live.
 * Re-run after editing pricing-plans.js.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PRICING_PLANS } from '../content/data/pricing-plans.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadEnv() {
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"|"$/g, '');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / SUPABASE_SECRET_KEY not set');

async function main() {
  const rows = PRICING_PLANS.map((p, i) => ({
    id: p.id,
    name: p.name,
    monthly_price_cents: p.monthlyPriceCents,
    min_commitment_months: p.minCommitmentMonths,
    positioning: p.positioning,
    features: p.features,
    zip_addon: p.zipAddon || null,
    sort_order: i,
    updated_at: new Date().toISOString(),
  }));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/plans`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates',
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) throw new Error(`Seed failed: ${res.status} ${await res.text()}`);
  console.log(`Seeded ${rows.length} plans into Supabase.`);
}

main();
