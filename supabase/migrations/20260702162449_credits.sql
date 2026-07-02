-- Free estimate credits — every account starts with 5 free estimate
-- generations. One credit is spent per estimate built (not per view/share).
-- spend_credit() atomically creates the profile row (if missing) and
-- decrements in one statement — no read-then-write race between concurrent
-- requests for the same user.

create table if not exists public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits_remaining integer not null default 5,
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
