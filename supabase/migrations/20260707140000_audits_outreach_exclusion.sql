-- Durable outreach-eligibility flag, separate from the admin table's
-- display logic — a future outreach/campaign process needs to be able to
-- exclude bad audits by a plain query, not by re-deriving the same regex
-- match against final_url every time. null = eligible; otherwise a short
-- machine-readable reason.
alter table public.audits
  add column if not exists outreach_excluded_reason text
    check (outreach_excluded_reason in ('crawl_blocked', 'unreachable') or outreach_excluded_reason is null);

create index if not exists audits_outreach_excluded_idx on public.audits (outreach_excluded_reason) where outreach_excluded_reason is not null;
