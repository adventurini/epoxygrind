-- Daily Instagram carousel content engine (Grinder Dad). Schema per
-- epoxygrind-carousel-engine-spec.md §5. topics is the reusable idea bank
-- (hook/4 points/closer as short skeleton phrases); days links a calendar
-- date to one topic; slides holds the actual per-day, per-position caption
-- text (editable independently, never mutating the shared topic) and the
-- overlay layout; generations is an append-only image-version log so
-- regeneration keeps prior versions selectable.

create table carousel_topics (
  id uuid primary key default gen_random_uuid(),
  audience text not null check (audience in ('consumer', 'contractor')),
  title text not null,
  hook text not null,
  points jsonb not null,
  closer text not null,
  source text,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table carousel_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  audience text not null check (audience in ('consumer', 'contractor')),
  topic_id uuid references carousel_topics(id),
  status text not null default 'empty'
    check (status in ('empty', 'drafted', 'generated', 'edited', 'downloaded', 'archived', 'needs_attention')),
  created_at timestamptz not null default now()
);

create table carousel_slides (
  id uuid primary key default gen_random_uuid(),
  day_id uuid not null references carousel_days(id) on delete cascade,
  position smallint not null check (position between 1 and 6),
  caption text,
  overlay jsonb not null default '{}'::jsonb,
  active_generation_id uuid,
  unique (day_id, position)
);

create table carousel_generations (
  id uuid primary key default gen_random_uuid(),
  slide_id uuid not null references carousel_slides(id) on delete cascade,
  prompt text not null,
  delta_prompt text,
  image_url text,
  model text,
  created_at timestamptz not null default now()
);

alter table carousel_slides
  add constraint carousel_slides_active_generation_fkey
  foreign key (active_generation_id) references carousel_generations(id);

-- Single-row-per-key store: LoRA id, trigger token, cost caps/totals.
create table carousel_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index carousel_topics_audience_used_at_idx on carousel_topics (audience, used_at nulls first);
create index carousel_days_status_idx on carousel_days (status);
create index carousel_slides_day_id_idx on carousel_slides (day_id);
create index carousel_generations_slide_id_idx on carousel_generations (slide_id);

-- Same convention as contractor_pipeline/contractor_notes: service-role
-- only, no client policies at all.
alter table carousel_topics enable row level security;
alter table carousel_days enable row level security;
alter table carousel_slides enable row level security;
alter table carousel_generations enable row level security;
alter table carousel_config enable row level security;
