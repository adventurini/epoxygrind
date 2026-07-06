-- Claim interstitial's "best phone for leads" — deliberately separate from
-- the scraped `phones` array (raw discovery data) since this is a
-- contractor-confirmed value used for lead routing + sales contact.
alter table public.contractors
  add column if not exists contact_phone text;
