create table if not exists public.product_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id text not null,
  merchant text,
  page text,
  page_template text,
  created_at timestamptz not null default now()
);

create index if not exists product_clicks_product_id_idx on public.product_clicks (product_id);
create index if not exists product_clicks_created_at_idx on public.product_clicks (created_at);

alter table public.product_clicks enable row level security;

-- Writes go through the service-role client from the /go/ redirect route
-- only; no public client-side access needed, so no policies are added.
