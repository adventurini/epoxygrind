-- Public storage bucket for contractor hero photos + logos (Google Places
-- photos, self-hosted; contractor logos, self-hosted from their own site).
-- Public (unlike estimate-images) — these are baked into static, publicly
-- indexed HTML at build time, so a permanent public URL is required; a
-- signed URL would expire and break the page.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'contractor-images',
  'contractor-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
