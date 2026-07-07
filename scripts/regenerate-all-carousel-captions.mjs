#!/usr/bin/env node
/**
 * One-off: re-runs caption generation for every already-scheduled
 * carousel day, using each day's current topic data — needed after
 * rewriting all 25 contractor topic closers to tie back to a happy
 * customer (Anthony). Captions only; does not touch images (a separate
 * pass regenerates images for the handful of days that already have
 * real generated images).
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

const { generateSlideCaptions } = await import('../lib/carousel/generate-captions.js');

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
  const days = await sb('carousel_days?status=neq.empty&select=id,date,audience,carousel_topics(id,title,hook,points,closer)&order=date.asc');
  console.log(`Found ${days.length} scheduled days.`);

  for (const day of days) {
    try {
      const captions = await generateSlideCaptions({ audience: day.audience, topic: day.carousel_topics });
      for (let i = 0; i < 6; i++) {
        await sb(`carousel_slides?day_id=eq.${day.id}&position=eq.${i + 1}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify({ caption: captions[i] }),
        });
      }
      console.log(`  ${day.date} (${day.audience}, "${day.carousel_topics.title}") — captions updated`);
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
