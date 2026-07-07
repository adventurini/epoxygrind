-- Logs every self-serve claim attempt from the public listing page
-- (api/contractor/claim-request.js), so an unmatched email doesn't just
-- vanish into a console.log the way api/contractor/request-link.js's
-- generic lookup does today — this is scoped to one specific listing and
-- needs a real manual-review queue for the cases that don't auto-verify.
create table if not exists public.claim_requests (
  id uuid primary key default gen_random_uuid(),
  contractor_id bigint references public.contractors(id) on delete cascade,
  email text not null,
  name text,
  match_type text not null check (match_type in ('domain', 'email_on_file', 'none')),
  status text not null default 'pending' check (status in ('auto_sent', 'pending_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists claim_requests_contractor_id_idx on public.claim_requests (contractor_id);
create index if not exists claim_requests_status_idx on public.claim_requests (status);

alter table public.claim_requests enable row level security;

-- Service-role only (written by api/contractor/claim-request.js, read from
-- a future admin review queue) — no client-side policies yet.
