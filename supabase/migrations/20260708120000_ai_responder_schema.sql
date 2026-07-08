-- AI Lead Responder + Call-to-Text-Back (spec §5). Phase 1 only wires up
-- voice/SMS webhooks + manual reply; ai_configs.profile/tools exist now
-- so Phase 2 doesn't need a schema migration to add the AI loop, but
-- nothing here writes to them yet except the account #1 seed row.
--
-- Multi-tenant from day one per spec's "non-negotiable architecture
-- rule" — but only account #1 (EpoxyGrind itself, profile
-- 'epoxygrind_showcase') is used in Phase 1. The contractor-facing site
-- template (spec §8) is a later phase and out of scope here.

create table responder_accounts (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  tier text check (tier in ('launch', 'dominate', 'own_your_market')),
  ein_status text,
  created_at timestamptz not null default now()
);

create table responder_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references responder_accounts(id) on delete cascade,
  twilio_number text not null unique,
  twilio_number_sid text,
  a2p_campaign_status text not null default 'not_started'
    check (a2p_campaign_status in ('not_started', 'pending', 'approved', 'rejected')),
  greeting_url text, -- null = use TTS <Say> fallback (spec §2.1: "fall back to Twilio TTS only until the recording exists")
  created_at timestamptz not null default now()
);

create table responder_contacts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references responder_accounts(id) on delete cascade,
  phone text not null, -- E.164
  name text,
  email text,
  opted_out boolean not null default false,
  first_source text,
  created_at timestamptz not null default now(),
  unique (account_id, phone)
);

create table responder_conversations (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references responder_accounts(id) on delete cascade,
  contact_id uuid not null references responder_contacts(id) on delete cascade,
  channel text not null check (channel in ('sms', 'web')),
  ai_paused boolean not null default false,
  status text not null default 'open' check (status in ('open', 'closed', 'needs_attention')),
  last_message_at timestamptz,
  created_at timestamptz not null default now()
);

create table responder_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references responder_conversations(id) on delete cascade,
  direction text not null check (direction in ('in', 'out')),
  sender_type text not null check (sender_type in ('contact', 'ai', 'human', 'system')),
  body text not null,
  twilio_sid text unique, -- idempotency key (spec §3.2: "Twilio retries webhooks; without this you'll double-reply")
  delivery_status text,
  created_at timestamptz not null default now()
);

create table responder_calls (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references responder_accounts(id) on delete cascade,
  contact_id uuid references responder_contacts(id) on delete set null,
  twilio_sid text unique,
  status text,
  duration_sec integer,
  was_missed boolean not null default true, -- text-first design: every call is "missed" by definition (spec §2.1)
  textback_sent boolean not null default false,
  recording_url text,
  line_type text, -- from Twilio Lookup line_type_intelligence: mobile / landline / voip / unknown
  created_at timestamptz not null default now()
);

create table responder_leads (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references responder_accounts(id) on delete cascade,
  contact_id uuid not null references responder_contacts(id) on delete cascade,
  source text not null check (source in ('missed_call', 'sms', 'web_chat', 'estimator')),
  status text not null default 'new'
    check (status in ('new', 'ai_qualifying', 'qualified', 'booked', 'won', 'lost', 'disqualified')),
  project_type text,
  sqft_estimate integer,
  zip text,
  timeline text,
  concrete_condition text,
  est_value_cents integer,
  status_changed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Append-only — every dashboard metric is a query over this table, never
-- a retrofit (spec §5).
create table responder_lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references responder_leads(id) on delete cascade,
  type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table responder_ai_configs (
  account_id uuid primary key references responder_accounts(id) on delete cascade,
  profile text not null check (profile in ('contractor', 'epoxygrind_showcase')),
  call_handling text not null default 'text_first' check (call_handling in ('text_first', 'forward_first')),
  notification_level text not null default 'important_only'
    check (notification_level in ('everything', 'important_only', 'daily_digest')),
  business_hours jsonb,
  services text[],
  service_area_zips text[],
  price_range_per_sqft jsonb,
  booking_url text,
  tone_notes text,
  custom_instructions text,
  owner_alert_phone text -- where "new lead"/"escalation"/"booked" SMS alerts go (spec §6.4)
);

create index responder_contacts_account_phone_idx on responder_contacts (account_id, phone);
create index responder_conversations_account_id_idx on responder_conversations (account_id, status, last_message_at desc);
create index responder_messages_conversation_id_idx on responder_messages (conversation_id, created_at);
create index responder_calls_account_id_idx on responder_calls (account_id, created_at desc);
create index responder_leads_account_id_idx on responder_leads (account_id, status);
create index responder_lead_events_lead_id_idx on responder_lead_events (lead_id, created_at);

alter table responder_accounts enable row level security;
alter table responder_phone_numbers enable row level security;
alter table responder_contacts enable row level security;
alter table responder_conversations enable row level security;
alter table responder_messages enable row level security;
alter table responder_calls enable row level security;
alter table responder_leads enable row level security;
alter table responder_lead_events enable row level security;
alter table responder_ai_configs enable row level security;

-- Account #1 = EpoxyGrind itself, running through the exact same tables
-- and code paths as every future client (spec §5's seed instruction).
insert into responder_accounts (id, company_name, tier)
values ('00000000-0000-0000-0000-000000000001', 'EpoxyGrind', 'own_your_market');

insert into responder_ai_configs (account_id, profile, notification_level)
values ('00000000-0000-0000-0000-000000000001', 'epoxygrind_showcase', 'everything');
