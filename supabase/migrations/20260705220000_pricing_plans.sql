-- Contractor-services pricing ladder (epoxygrind-pricing-spec.md §1-2).
-- Config, not rows users create — seeded once from content/data/
-- pricing-plans.js by scripts/seed-pricing-plans.js, read-only from the
-- client. Gives the future dashboard/demo-reveal views a single place to
-- read current pricing instead of hardcoding numbers again.
create table if not exists plans (
  id text primary key,
  name text not null,
  monthly_price_cents int not null,
  min_commitment_months int not null default 1,
  positioning text not null,
  features jsonb not null,
  zip_addon jsonb,
  sort_order int not null,
  updated_at timestamptz not null default now()
);

alter table plans enable row level security;

drop policy if exists "plans are publicly readable" on plans;
create policy "plans are publicly readable" on plans
  for select using (true);
