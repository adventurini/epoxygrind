-- karl@battlejuice.com should become an admin the first time he ever
-- signs in, regardless of method (magic link or Google OAuth both create a
-- real row in auth.users on first successful auth) — there's no existing
-- app-level hook that fires on every signin method before a profiles row
-- might get created (profiles is otherwise only lazily created by
-- spend_credit()), so this is a DB trigger rather than application code.
create or replace function public.grant_admin_on_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email = 'karl@battlejuice.com' then
    insert into public.profiles (user_id, is_admin)
    values (new.id, true)
    on conflict (user_id) do update set is_admin = true;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_grant_admin on auth.users;
create trigger on_auth_user_created_grant_admin
  after insert on auth.users
  for each row execute function public.grant_admin_on_signup();
