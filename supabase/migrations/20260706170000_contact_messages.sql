-- General site contact form (homepage footer) — separate from
-- contractor_leads (which is scoped to a specific contractor listing).
create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  message text not null,
  source_path text,
  created_at timestamptz not null default now()
);

create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at);

alter table public.contact_messages enable row level security;

-- Service-role only (written from /api/contact, read from the admin
-- dashboard) — no client-side policies needed.
