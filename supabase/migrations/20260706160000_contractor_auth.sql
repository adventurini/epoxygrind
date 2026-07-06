-- Master spec Phase 1: contractor claim + magic-link auth.
-- Auth is tied to contractor_id, NOT email — a claim/login link works
-- regardless of which inbox it lands in, and a contractor can change
-- their contact email later without breaking anything.
alter table public.contractors
  add column if not exists contact_email text,
  add column if not exists email_verified_at timestamptz,
  add column if not exists claimed_at timestamptz,
  add column if not exists last_login_at timestamptz,
  add column if not exists sms_consent_at timestamptz;

create table if not exists public.auth_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  contractor_id bigint not null references public.contractors(id) on delete cascade,
  purpose text not null check (purpose in ('claim', 'login', 'preview')),
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_tokens_contractor_id_idx on public.auth_tokens (contractor_id);
create index if not exists auth_tokens_token_hash_idx on public.auth_tokens (token_hash);

alter table public.auth_tokens enable row level security;

-- Service-role only (issued/verified from serverless functions); no
-- client-side access needed, so no policies.
