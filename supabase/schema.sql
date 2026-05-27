-- True Colors Assessment — Supabase schema
--
-- This table is written from the server using the service role key only.
-- There is no RLS policy exposing it to the anon role; clients never read or
-- write it directly. If you turn RLS on, leave it on with no permissive
-- policies — the service role bypasses RLS.
--
-- `zoho_module` is a free-form string because we use a custom module
-- (`Contacts_Hub`) in addition to standard ones. The submit route mirrors
-- scores to a linked Deal when Relationship = "Opportunity Owner".

create table if not exists assessment_progress (
  token             text primary key,
  zoho_module       text not null,
  zoho_record_id    text not null,
  first_name        text,
  last_name         text,
  email             text,
  responses         jsonb not null default '[]'::jsonb,
  scores            jsonb,
  is_complete       boolean not null default false,
  started_at        timestamptz,
  completed_at      timestamptz,
  zoho_synced_at    timestamptz,
  zoho_sync_error   text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists assessment_progress_zoho_idx
  on assessment_progress (zoho_module, zoho_record_id);

create or replace function assessment_progress_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists assessment_progress_updated_at on assessment_progress;
create trigger assessment_progress_updated_at
before update on assessment_progress
for each row execute function assessment_progress_set_updated_at();

-- Enable RLS so the anon key truly cannot reach it. Service role bypasses RLS
-- so the server still works.
alter table assessment_progress enable row level security;


-- ---------------------------------------------------------------------------
-- MIGRATION
--
-- Run this if you already ran the original schema (with the Leads/Contacts/Deals
-- check constraint and the `primary_color` column). Safe to run multiple times.
-- ---------------------------------------------------------------------------

alter table assessment_progress
  drop constraint if exists assessment_progress_zoho_module_check;

alter table assessment_progress
  drop column if exists primary_color;
