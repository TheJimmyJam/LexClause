-- ============================================================================
-- Migration 016 — team / multi-user organizations
--
-- Lets a firm with multiple coverage attorneys share matters and analyses.
-- Adds an `lc_invitations` table for the invite flow, RLS so only org admins
-- can manage invites, and extends the signup trigger so an invitee who
-- registers with a matching token joins the inviting org instead of creating
-- a fresh one.
--
-- All existing org-scoped RLS (lc_matters / lc_policies / lc_analyses / etc.)
-- already keys off `lc_user_org()` returning the user's lc_profiles.org_id.
-- That means once an invitee's profile is created with the right org_id, they
-- automatically see everything in that org. No per-table changes needed.
-- ============================================================================

create extension if not exists pgcrypto;  -- for gen_random_uuid()

-- ── lc_invitations table ────────────────────────────────────────────────────
create table if not exists lc_invitations (
  id           uuid primary key default gen_random_uuid(),
  token        uuid not null default gen_random_uuid(),
  org_id       uuid not null references lc_organizations(id) on delete cascade,
  email        text not null,
  role         text not null check (role in ('admin','member')),
  invited_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default (now() + interval '14 days'),
  accepted_at  timestamptz,
  accepted_by  uuid references auth.users(id) on delete set null,
  revoked_at   timestamptz
);
create unique index if not exists lc_invitations_token_idx on lc_invitations(token);
create index        if not exists lc_invitations_email_idx on lc_invitations(lower(email));
create index        if not exists lc_invitations_org_idx   on lc_invitations(org_id);

comment on table  lc_invitations is 'Pending and accepted invitations for org membership.';
comment on column lc_invitations.token is 'Opaque uuid the invitee presents to claim the invite. Sent only via email.';

-- ── RLS — only org admins can manage invitations ────────────────────────────
alter table lc_invitations enable row level security;

drop policy if exists "lc_invitations admin all" on lc_invitations;
create policy "lc_invitations admin all" on lc_invitations
  for all
  using (
    org_id = lc_user_org()
    and exists (
      select 1 from lc_profiles
      where id = auth.uid() and role = 'admin'
    )
  )
  with check (
    org_id = lc_user_org()
    and exists (
      select 1 from lc_profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- The trigger function is SECURITY DEFINER so it bypasses RLS to look up the
-- invitation by token at signup time. Application code never SELECTs invitations
-- on behalf of an anon user.

-- ── lc_profiles role constraint hardening ───────────────────────────────────
-- Make sure role is restricted to known values (was previously a free-text col).
alter table lc_profiles
  drop constraint if exists lc_profiles_role_check;
alter table lc_profiles
  add  constraint lc_profiles_role_check
  check (role in ('admin','member'));

-- ── Extend signup trigger to honor invitations ──────────────────────────────
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
  invite_token uuid;
  invite       lc_invitations%rowtype;
begin
  org_label   := coalesce(nullif(new.raw_user_meta_data->>'org_name', ''), split_part(new.email, '@', 1));
  fname       := nullif(new.raw_user_meta_data->>'first_name', '');
  lname       := nullif(new.raw_user_meta_data->>'last_name',  '');
  ack_flag    := coalesce((new.raw_user_meta_data->>'disclaimer_acknowledged')::boolean, false);
  ack_version := nullif(new.raw_user_meta_data->>'disclaimer_version', '');
  ack_at      := case when ack_flag then now() else null end;

  -- If the signup payload includes an invite_token, attempt to consume it.
  -- We require an exact email match (case-insensitive) so a leaked token can't
  -- be used by an unrelated email.
  begin
    invite_token := nullif(new.raw_user_meta_data->>'invite_token', '')::uuid;
  exception when others then
    invite_token := null;
  end;

  if invite_token is not null then
    select * into invite
      from lc_invitations
     where token        = invite_token
       and accepted_at is null
       and revoked_at  is null
       and expires_at  > now()
       and lower(email) = lower(new.email)
     limit 1;
  end if;

  if invite.id is not null then
    -- Invited signup → join the existing org with the role the invitation specified
    insert into lc_profiles (
      id, org_id, email, first_name, last_name, role,
      disclaimer_acknowledged_at, disclaimer_version
    )
    values (
      new.id, invite.org_id, new.email, fname, lname, invite.role,
      ack_at, ack_version
    )
    on conflict (id) do update set
      email                      = excluded.email,
      first_name                 = coalesce(excluded.first_name, lc_profiles.first_name),
      last_name                  = coalesce(excluded.last_name,  lc_profiles.last_name),
      org_id                     = excluded.org_id,    -- override: invite supersedes any prior org
      role                       = excluded.role,
      disclaimer_acknowledged_at = coalesce(lc_profiles.disclaimer_acknowledged_at, excluded.disclaimer_acknowledged_at),
      disclaimer_version         = coalesce(lc_profiles.disclaimer_version,         excluded.disclaimer_version);

    update lc_invitations
       set accepted_at = now(),
           accepted_by = new.id
     where id = invite.id;
  else
    -- Standard new-org signup — first user is admin
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
  end if;

  return new;
end;
$function$;
