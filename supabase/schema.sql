-- True Colors Assessment — Supabase schema
--
-- This table is written from the server using the service role key only.
-- There is no RLS policy exposing it to the anon role; clients never read or
-- write it directly. If you turn RLS on, leave it on with no permissive
-- policies — the service role bypasses RLS.

create table if not exists assessment_progress (
  token             text primary key,
  zoho_module       text not null check (zoho_module in ('Leads','Contacts','Deals')),
  zoho_record_id   text not null,
  first_name        text,
  last_name         text,
  email             text,
  responses         jsonb not null default '[]'::jsonb,
  scores            jsonb,
  primary_color     text check (primary_color in ('orange','blue','gold','green')),
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

-- Optional: enable RLS so the anon key truly cannot reach it. Service role
-- bypasses RLS so the server still works.
alter table assessment_progress enable row level security;
