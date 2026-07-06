-- siteStructure category (lib/audit/scoring-structure.js) + the raw per-page
-- URL map from lib/audit/site-structure.js — the latter isn't part of the
-- score, it's the sitewide URL/title/meta list a future site-rebuild/SEO
-- pass reads for each contractor's existing site.
alter table public.audits
  add column if not exists site_structure jsonb;
