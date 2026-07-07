-- A note logged with a method is a real contact attempt (call/text/email/in
-- person), not just a freeform observation — lets the admin dashboard show
-- and filter on "how/when was this contractor last contacted" instead of
-- only a single current pipeline stage.
alter table contractor_notes add column if not exists method text
  check (method in ('call', 'text', 'email', 'in_person', 'other'));

create index if not exists contractor_notes_contractor_id_created_at_idx
  on contractor_notes (contractor_id, created_at desc);
