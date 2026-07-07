-- Outreach pipeline tracking for the admin audits dashboard — a real CRM
-- need (call status, whether they responded, free-form notes over time),
-- separate from the audit/contractor tables since it's about US working
-- the lead, not about the contractor's site or listing.
create table if not exists public.contractor_pipeline (
  contractor_id bigint primary key references public.contractors(id) on delete cascade,
  stage text not null default 'not_contacted'
    check (stage in ('not_contacted', 'called', 'audit_texted', 'responded', 'no_response', 'rebuilt', 'lost')),
  answered boolean, -- null = unknown/not yet applicable, true/false once known
  updated_at timestamptz not null default now()
);

create table if not exists public.contractor_notes (
  id uuid primary key default gen_random_uuid(),
  contractor_id bigint not null references public.contractors(id) on delete cascade,
  note text not null,
  created_at timestamptz not null default now()
);

create index if not exists contractor_notes_contractor_id_idx on public.contractor_notes (contractor_id);

alter table public.contractor_pipeline enable row level security;
alter table public.contractor_notes enable row level security;

-- Service-role only (read/written by the admin dashboard) — no client-side
-- policies needed yet.
