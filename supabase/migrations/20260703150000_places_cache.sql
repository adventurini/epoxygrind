-- Google Places review cache (BUILD-places-reviews.md). Fetch once per
-- place_id, cache for TTL_DAYS in the Edge Function, serve from cache —
-- cost scales with places viewed, not with traffic.

create table if not exists public.places_cache (
  place_id text primary key,
  data jsonb,
  status text not null default 'empty' check (status in ('empty', 'ok', 'error')),
  error text,
  fetched_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists places_cache_fetched_at_idx on public.places_cache (fetched_at);

-- Stampede lock: only one in-flight refresh per place_id at a time.
create table if not exists public.places_inflight (
  place_id text primary key,
  claimed_at timestamptz not null default now()
);

create table if not exists public.places_stats (
  k text primary key,
  v bigint not null default 0
);

create or replace function public.bump_stat(key text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.places_stats (k, v) values (key, 1)
  on conflict (k) do update set v = places_stats.v + 1;
$$;

-- Atomically claim the right to refresh a place. Returns true if this
-- caller won the claim; false if another request already holds it.
-- Claims older than 120s are treated as crashed and reclaimed.
create or replace function public.claim_place(pid text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  won boolean;
begin
  insert into public.places_inflight (place_id, claimed_at)
  values (pid, now())
  on conflict (place_id) do update
    set claimed_at = now()
    where places_inflight.claimed_at < now() - interval '120 seconds'
  returning true into won;

  return coalesce(won, false);
end;
$$;

alter table public.places_cache enable row level security;
alter table public.places_inflight enable row level security;
alter table public.places_stats enable row level security;

-- No policies on any of the three: the Edge Function uses the
-- service_role key (bypasses RLS); the browser gets zero direct access.
