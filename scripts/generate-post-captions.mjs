#!/usr/bin/env node
/**
 * One-off: generates the IG/FB post-caption field (spec §9, separate from
 * the on-image screen captions) for every already-scheduled carousel day
 * that doesn't have one yet — these 30 days were created before this
 * feature existed. Future days get one automatically via fill-horizon.js.
 */
import { readFileSync } from 'node:fs';

function loadEnv() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

const { generatePostCaption } = await import('../lib/carousel/generate-post-caption.js');

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const days = await sb('carousel_days?status=neq.empty&ig_caption=is.null&select=id,date,audience,carousel_topics(title,hook,points,closer)&order=date.asc');
  console.log(`Found ${days.length} scheduled days missing a post caption.`);

  for (const day of days) {
    try {
      const caption = await generatePostCaption({ audience: day.audience, topic: day.carousel_topics });
      await sb(`carousel_days?id=eq.${day.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ ig_caption: caption }),
      });
      console.log(`  ${day.date} (${day.audience}) — post caption generated (${caption.length} chars)`);
    } catch (err) {
      console.error(`  FAILED ${day.date}: ${err.message}`);
    }
  }
  console.log('Done.');
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
