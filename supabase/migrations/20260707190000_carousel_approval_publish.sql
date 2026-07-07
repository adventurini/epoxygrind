-- Spec update: single reference-image generation (no LoRA), an approval
-- gate before anything can publish, and a publishing log (IG/FB only —
-- TikTok dropped from scope). `downloaded` demotes from a status value to
-- a plain flag, since it isn't a stage in the same sense the others are.

alter table carousel_days add column post_time time;
alter table carousel_days add column ig_caption text;
alter table carousel_days add column approved_at timestamptz;
alter table carousel_days add column downloaded boolean not null default false;

alter table carousel_days drop constraint carousel_days_status_check;
alter table carousel_days add constraint carousel_days_status_check
  check (status in ('empty', 'drafted', 'generated', 'edited', 'approved', 'published', 'needs_attention', 'archived'));

alter table carousel_slides add column final_url text;

create table carousel_publishes (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references carousel_days(id) on delete cascade,
  platform text not null check (platform in ('ig', 'fb')),
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  platform_post_id text,
  error text,
  attempted_at timestamptz not null default now()
);

create index carousel_publishes_day_id_idx on carousel_publishes (day_id);

alter table carousel_publishes enable row level security;
