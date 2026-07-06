-- Public storage bucket for product/editorial photos (real product photos
-- recovered from merchant pages, plus AI-generated fallbacks when a real
-- photo isn't obtainable) — distinct from contractor-images, which is
-- contractor hero photos/logos only. Public for the same reason as
-- contractor-images: baked into static, publicly indexed HTML at build time.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'content-images',
  'content-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
