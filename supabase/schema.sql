-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create extension if not exists "pgcrypto";

create table if not exists public.estimates (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  customer_name text,
  project_name text,
  payload jsonb not null
);

create index if not exists estimates_created_at_idx on public.estimates (created_at desc);

alter table public.estimates enable row level security;

-- No public policies: server uses service role key from /api routes only.
