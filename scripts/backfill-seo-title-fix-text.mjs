#!/usr/bin/env node
/**
 * One-off: the SEO title-tag "fix" copy used to hardcode
 * `Epoxy Flooring in ${contractor.city}` — wrong on two real, confirmed
 * counts: contractor.city is Google-Places-sourced and can be flatly wrong
 * (one contractor's DB city said "Houston" while their own site titles
 * itself "Austin's Concrete Coating Expert"), and plenty of contractors
 * aren't primarily epoxy (decorative concrete, sealers, stamped concrete,
 * etc.). Patches the already-stored fix text for every audit that has the
 * old hardcoded copy — doesn't touch scores/grades, since this check's
 * pass/fail logic was never wrong, only the suggested copy.
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
const NEW_FIX = 'Write a title like "[Your Main Service] in [Your City] | [Business Name]", 10-60 characters.';

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

function isStaleFix(fix) {
  return typeof fix === 'string' && fix.startsWith('Write a title like "Epoxy Flooring in');
}

async function main() {
  const PAGE_SIZE = 1000;
  let all = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const rows = await sb(`audits?select=id,category_scores,top_findings`, {
      headers: { Range: `${from}-${from + PAGE_SIZE - 1}` },
    });
    if (!rows.length) break;
    all = all.concat(rows);
    if (rows.length < PAGE_SIZE) break;
  }
  console.log(`Loaded ${all.length} audits.`);

  const affected = all.filter((r) => {
    const t = r.category_scores?.seo?.checks?.find((c) => c.label === 'Title tag');
    const tf = (r.top_findings || []).find((f) => f.label === 'Title tag');
    return isStaleFix(t?.fix) || isStaleFix(tf?.fix);
  });
  console.log(`Found ${affected.length} affected.`);

  let patched = 0;
  for (const row of affected) {
    const body = {};

    if (row.category_scores?.seo?.checks) {
      const checks = row.category_scores.seo.checks.map((c) =>
        c.label === 'Title tag' && isStaleFix(c.fix) ? { ...c, fix: NEW_FIX } : c,
      );
      body.category_scores = { ...row.category_scores, seo: { ...row.category_scores.seo, checks } };
    }

    if (Array.isArray(row.top_findings)) {
      body.top_findings = row.top_findings.map((f) =>
        f.label === 'Title tag' && isStaleFix(f.fix) ? { ...f, fix: NEW_FIX } : f,
      );
    }

    await sb(`audits?id=eq.${row.id}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify(body),
    });
    patched++;
  }
  console.log(`Patched ${patched}. Done.`);
}

main().catch((err) => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
