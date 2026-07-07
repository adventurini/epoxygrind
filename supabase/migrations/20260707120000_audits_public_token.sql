-- Unguessable per-audit share link (no login required) — for cold outreach:
-- "here's your free audit" without asking a prospect to create an account
-- first. Volatile default (gen_random_uuid()) still backfills existing
-- rows individually on ADD COLUMN, but do it explicitly for clarity.
alter table public.audits add column if not exists public_token uuid;
update public.audits set public_token = gen_random_uuid() where public_token is null;
alter table public.audits alter column public_token set default gen_random_uuid();
alter table public.audits alter column public_token set not null;
create unique index if not exists audits_public_token_idx on public.audits (public_token);
