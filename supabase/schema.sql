-- EpoxyGrind database schema (run against linked Supabase project)

create extension if not exists "pgcrypto";

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete cascade,
  customer_name text,
  email text,
  location text,
  project_name text,
  finish text check (finish is null or finish in ('solid', 'flake', 'metallic')),
  finish_label text,
  pattern text,
  pattern_label text,
  base_color text,
  base_color_label text,
  base_color_hex text,
  flake_color text,
  flake_color_label text,
  flake_color_hex text,
  color_label text,
  sq_ft numeric(10, 2),
  total_low numeric(12, 2),
  total_high numeric(12, 2),
  space_type text,
  original_image_path text,
  payload jsonb not null default '{}'::jsonb
);

-- Safe upgrades for databases created from older schema versions
alter table public.estimates add column if not exists user_id uuid references auth.users (id) on delete cascade;
alter table public.estimates add column if not exists email text;
alter table public.estimates add column if not exists location text;
alter table public.estimates add column if not exists updated_at timestamptz not null default now();
alter table public.estimates add column if not exists finish text;
alter table public.estimates add column if not exists finish_label text;
alter table public.estimates add column if not exists pattern text;
alter table public.estimates add column if not exists pattern_label text;
alter table public.estimates add column if not exists base_color text;
alter table public.estimates add column if not exists base_color_label text;
alter table public.estimates add column if not exists base_color_hex text;
alter table public.estimates add column if not exists flake_color text;
alter table public.estimates add column if not exists flake_color_label text;
alter table public.estimates add column if not exists flake_color_hex text;
alter table public.estimates add column if not exists color_label text;
alter table public.estimates add column if not exists sq_ft numeric(10, 2);
alter table public.estimates add column if not exists total_low numeric(12, 2);
alter table public.estimates add column if not exists total_high numeric(12, 2);
alter table public.estimates add column if not exists space_type text;
alter table public.estimates add column if not exists original_image_path text;

create index if not exists estimates_created_at_idx on public.estimates (created_at desc);
create index if not exists estimates_user_id_idx on public.estimates (user_id, created_at desc);
create index if not exists estimates_location_idx on public.estimates (location);
create index if not exists estimates_finish_idx on public.estimates (finish);

alter table public.estimates enable row level security;

drop policy if exists "Users read own estimates" on public.estimates;
create policy "Users read own estimates"
  on public.estimates
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Full estimate detail (line items, market data, preview context) stays in payload jsonb.
-- Uploaded photo path: estimates.original_image_path
-- Generated preview files: estimate_previews.storage_path (+ Supabase Storage bucket)

create table if not exists public.estimate_previews (
  id uuid primary key default gen_random_uuid(),
  estimate_id uuid not null references public.estimates (id) on delete cascade,
  angle_id text not null,
  label text,
  storage_path text not null,
  created_at timestamptz not null default now(),
  unique (estimate_id, angle_id)
);

create index if not exists estimate_previews_estimate_id_idx
  on public.estimate_previews (estimate_id, angle_id);

alter table public.estimate_previews enable row level security;

drop policy if exists "Users read own estimate previews" on public.estimate_previews;
create policy "Users read own estimate previews"
  on public.estimate_previews
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.estimates e
      where e.id = estimate_previews.estimate_id
        and e.user_id = auth.uid()
    )
  );

-- Server routes use the service role key and bypass RLS.

-- ── Storage: estimate photos & AI previews ───────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'estimate-images',
  'estimate-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage: contractor hero photos & logos (public — baked into static,
-- publicly indexed HTML at build time, so URLs must never expire) ──────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contractor-images',
  'contractor-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Backfill queryable columns from existing payload rows
update public.estimates
set
  finish = coalesce(finish, nullif(payload #>> '{meta,finish}', ''), nullif(payload #>> '{pricing,finish}', ''), nullif(payload #>> '{design,finish}', '')),
  finish_label = coalesce(finish_label, nullif(payload #>> '{pricing,finishLabel}', '')),
  pattern = coalesce(pattern, nullif(payload #>> '{design,pattern}', '')),
  pattern_label = coalesce(pattern_label, nullif(payload #>> '{design,patternLabel}', '')),
  base_color = coalesce(base_color, nullif(payload #>> '{design,baseColor}', '')),
  base_color_label = coalesce(base_color_label, nullif(payload #>> '{design,baseColorLabel}', '')),
  base_color_hex = coalesce(base_color_hex, nullif(payload #>> '{design,baseColorHex}', '')),
  flake_color = coalesce(flake_color, nullif(payload #>> '{design,flakeColor}', '')),
  flake_color_label = coalesce(flake_color_label, nullif(payload #>> '{design,flakeColorLabel}', '')),
  flake_color_hex = coalesce(flake_color_hex, nullif(payload #>> '{design,flakeColorHex}', '')),
  color_label = coalesce(color_label, nullif(payload #>> '{design,colorLabel}', ''), nullif(payload #>> '{design,summary}', '')),
  sq_ft = coalesce(sq_ft, nullif(payload #>> '{pricing,sqFt}', '')::numeric, nullif(payload #>> '{analysis,estimatedSqFt}', '')::numeric),
  total_low = coalesce(total_low, nullif(payload #>> '{pricing,totalLow}', '')::numeric),
  total_high = coalesce(total_high, nullif(payload #>> '{pricing,totalHigh}', '')::numeric),
  space_type = coalesce(space_type, nullif(payload #>> '{analysis,spaceType}', '')),
  original_image_path = coalesce(original_image_path, nullif(payload ->> 'originalImagePath', '')),
  updated_at = now()
where payload <> '{}'::jsonb;

insert into public.estimate_previews (estimate_id, angle_id, label, storage_path)
select
  e.id,
  p.value ->> 'id',
  nullif(p.value ->> 'label', ''),
  p.value ->> 'path'
from public.estimates e
cross join lateral jsonb_array_elements(e.payload -> 'previewPaths') as p(value)
where e.payload ? 'previewPaths'
  and coalesce(p.value ->> 'id', '') <> ''
  and coalesce(p.value ->> 'path', '') <> ''
on conflict (estimate_id, angle_id) do update set
  label = excluded.label,
  storage_path = excluded.storage_path;

-- ── Free estimate credits ──────────────────────────────────────────────────
-- Every account starts with 5 free estimate generations. One credit is spent
-- per estimate built (not per view/share). Server routes use the service
-- role key and call spend_credit(), which atomically creates the profile
-- row (if missing) and decrements in one statement — no read-then-write
-- race between concurrent requests for the same user.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits_remaining integer not null default 5,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "Users read own profile" on public.profiles;
create policy "Users read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.spend_credit(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  remaining integer;
begin
  insert into public.profiles (user_id, credits_remaining)
  values (p_user_id, 5)
  on conflict (user_id) do nothing;

  update public.profiles
  set credits_remaining = credits_remaining - 1, updated_at = now()
  where user_id = p_user_id and credits_remaining > 0
  returning credits_remaining into remaining;

  return remaining; -- null when the user had 0 credits left
end;
$$;

-- DIY & Product Content Spec §2: outbound product-link click tracking.
create table if not exists public.product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  merchant text,
  page text,
  page_template text,
  created_at timestamptz not null default now()
);

create index if not exists product_clicks_product_id_idx on public.product_clicks (product_id);
create index if not exists product_clicks_created_at_idx on public.product_clicks (created_at);

alter table public.product_clicks enable row level security;

-- Writes go through the service-role client from the /go/ redirect route
-- only; no public client-side access needed, so no policies are added.

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

-- Contractor directory data (BUILD-everything.md step 3). Loaded from
-- content/data/enriched.json (scripts/enrich-contractors.py output) via
-- scripts/load-contractors.js. Reviews are NOT stored here — those are
-- fetched live and cached separately in places_cache (step 4).
create table if not exists public.contractors (
  id bigint generated by default as identity primary key,
  place_id text unique,
  name text not null,
  website text,
  city text,
  state text,
  phones jsonb not null default '[]',
  emails jsonb not null default '[]',
  services jsonb not null default '[]',
  raw_services jsonb not null default '[]',
  service_areas jsonb not null default '[]',
  trust_signals jsonb not null default '{}',
  socials jsonb not null default '{}',
  has_photo_gallery boolean not null default false,
  has_contact_form boolean not null default false,
  title text,
  meta_description text,
  status text not null default 'ok',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contractors_state_idx on public.contractors (state);
create index if not exists contractors_city_idx on public.contractors (city);

alter table public.contractors enable row level security;

-- No policies: this table is loaded and read by build-time/service-role
-- scripts only (the static site reads content/data/enriched.json directly
-- at build time). No public client-side access needed yet.

-- Leads captured from the form at the bottom of every contractor profile
-- page. Public-facing insert path (api/contractor-lead.js, service-role
-- only — no anon INSERT policy, the API route is the only writer) so a
-- spam bot can't hit the table directly even if it discovers the endpoint
-- shape; the honeypot field in the API route is the first line of defense,
-- this is the second.
create table if not exists public.contractor_leads (
  id uuid primary key default gen_random_uuid(),
  contractor_state_slug text not null,
  contractor_slug text not null,
  contractor_name text not null,
  source_path text not null,
  name text not null,
  email text not null,
  phone text,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists contractor_leads_created_at_idx on public.contractor_leads (created_at desc);
create index if not exists contractor_leads_contractor_idx on public.contractor_leads (contractor_state_slug, contractor_slug);

alter table public.contractor_leads enable row level security;

-- No policies: only the service-role key (api/contractor-lead.js for
-- inserts, api/admin/contractor-leads.js for reads) touches this table.
