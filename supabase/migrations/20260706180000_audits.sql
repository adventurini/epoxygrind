-- Master spec Phase 2: audit engine results, one row per audit run.
-- category_scores/screenshots/raw are JSONB so the scoring engine can
-- evolve (add/remove checks) without a schema migration each time.
create table if not exists public.audits (
  id uuid primary key default gen_random_uuid(),
  contractor_id bigint references public.contractors(id) on delete cascade,
  audited_at timestamptz not null default now(),
  has_website boolean not null default false,
  site_unreachable boolean not null default false,
  final_url text,
  composite_score int,
  grade text,
  grade_color text,
  grade_header text,
  category_scores jsonb,
  top_findings jsonb,
  screenshots jsonb,
  error text
);

create index if not exists audits_contractor_id_idx on public.audits (contractor_id);
create index if not exists audits_audited_at_idx on public.audits (audited_at);

alter table public.audits enable row level security;

-- Service-role only (written by scripts/run-audits.js, read from a future
-- admin/contractor dashboard) — no client-side policies yet.
