-- Scoped, non-admin logins for client-site admin panels (e.g. the
-- Mirrorball Epoxy demo's own /admin/ — see mirrorball-epoxy repo).
-- A profile with client_scope set can authenticate and see only the data
-- tagged to that scope (contact_messages.source_path starting with
-- '/{client_scope}'), never other contractors' data and never the full
-- EpoxyGrind admin surface — distinct from is_admin, which is unrestricted.
alter table public.profiles
  add column if not exists client_scope text;

comment on column public.profiles.client_scope is
  'When set, this user can log in to a client-site admin panel scoped to leads/messages tagged with a matching source_path prefix (e.g. ''mirrorball-epoxy'' -> /mirrorball-epoxy-demo/*). Null for normal users and full admins.';
