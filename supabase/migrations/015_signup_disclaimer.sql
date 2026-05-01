-- ============================================================================
-- Migration 015 — signup disclaimer acknowledgment
--
-- New users must acknowledge that LexClause is a software service (not a law
-- firm), that opinions are draft work product, and that they will verify
-- conclusions before relying on them. The acknowledgment is captured in the
-- registration form, passed through raw_user_meta_data, and persisted by the
-- handle_new_lexclause_user() trigger when the auth.users row is inserted.
--
-- Schema:
--   lc_profiles.disclaimer_acknowledged_at (timestamptz)
--   lc_profiles.disclaimer_version         (text — e.g. 'v1' so we can re-prompt
--                                           if we materially change the wording)
--
-- Existing users have NULL acknowledgment. They are NOT auto-migrated; if we
-- want to retroactively gate them we add a separate migration / UI prompt.
-- ============================================================================

alter table lc_profiles
  add column if not exists disclaimer_acknowledged_at timestamptz,
  add column if not exists disclaimer_version         text;

comment on column lc_profiles.disclaimer_acknowledged_at is
  'Timestamp at which the user acknowledged the LexClause disclaimer. NULL = not yet acknowledged.';
comment on column lc_profiles.disclaimer_version is
  'Version of the disclaimer the user acknowledged (e.g. ''v1''). Lets us re-prompt on material changes.';

-- ── Replace the signup trigger so it captures the acknowledgment ───────────
create or replace function public.handle_new_lexclause_user()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
declare
  new_org_id   uuid;
  org_label    text;
  fname        text;
  lname        text;
  ack_flag     boolean;
  ack_version  text;
  ack_at       timestamptz;
begin
  org_label   := coalesce(nullif(new.raw_user_meta_data->>'org_name', ''), split_part(new.email, '@', 1));
  fname       := nullif(new.raw_user_meta_data->>'first_name', '');
  lname       := nullif(new.raw_user_meta_data->>'last_name',  '');
  ack_flag    := coalesce((new.raw_user_meta_data->>'disclaimer_acknowledged')::boolean, false);
  ack_version := nullif(new.raw_user_meta_data->>'disclaimer_version', '');
  ack_at      := case when ack_flag then now() else null end;

  insert into lc_organizations (name)
  values (org_label)
  returning id into new_org_id;

  insert into lc_profiles (
    id, org_id, email, first_name, last_name, role,
    disclaimer_acknowledged_at, disclaimer_version
  )
  values (
    new.id, new_org_id, new.email, fname, lname, 'admin',
    ack_at, ack_version
  )
  on conflict (id) do update set
    email                      = excluded.email,
    first_name                 = coalesce(excluded.first_name, lc_profiles.first_name),
    last_name                  = coalesce(excluded.last_name,  lc_profiles.last_name),
    org_id                     = coalesce(lc_profiles.org_id,  excluded.org_id),
    disclaimer_acknowledged_at = coalesce(lc_profiles.disclaimer_acknowledged_at, excluded.disclaimer_acknowledged_at),
    disclaimer_version         = coalesce(lc_profiles.disclaimer_version,         excluded.disclaimer_version);
  return new;
end;
$function$;
