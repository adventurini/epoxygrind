#!/usr/bin/env node
/**
 * One-time seed of the two carousel topic pools (spec §2.1) into
 * carousel_topics. Safe to re-run: skips any (audience, title) pair that
 * already exists rather than inserting duplicates.
 */
import { readFileSync } from 'node:fs';
import { CONTRACTOR_TOPICS, CONSUMER_TOPICS } from '../lib/carousel/topic-seed-data.js';

function loadEnv() {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m) process.env[m[1]] = process.env[m[1]] || m[2].replace(/^"(.*)"$/, '$1');
  }
}
loadEnv();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SECRET_KEY;

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
  if (!res.ok) throw new Error(`Supabase ${path} -> ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function main() {
  const existing = await sb('carousel_topics?select=audience,title');
  const existingKey = new Set(existing.map((t) => `${t.audience}::${t.title}`));

  let inserted = 0, skipped = 0;
  for (const [audience, topics] of [['contractor', CONTRACTOR_TOPICS], ['consumer', CONSUMER_TOPICS]]) {
    for (const t of topics) {
      const key = `${audience}::${t.title}`;
      if (existingKey.has(key)) { skipped++; continue; }
      await sb('carousel_topics', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          audience,
          title: t.title,
          hook: t.hook,
          points: t.points,
          closer: t.closer,
          source: t.source || null,
        }),
      });
      inserted++;
    }
  }
  console.log(`Inserted ${inserted}, skipped ${skipped} (already present).`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
