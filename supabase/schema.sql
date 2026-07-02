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
