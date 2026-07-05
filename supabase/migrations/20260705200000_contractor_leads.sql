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
