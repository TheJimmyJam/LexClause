-- ============================================================================
-- Migration 017 — sub-teams within an organization
--
-- A real law firm has practice groups: a Coverage Litigation Team, a
-- Construction Defect Group, an Asbestos Practice. Each team contains a
-- subset of the org's attorneys. This migration adds:
--
--   lc_teams              — sub-groups of users within an org
--   lc_team_memberships   — many-to-many between users and teams
--   lc_invitations.team_id — optional team to add an invitee to on accept
--
-- For now, matters remain ORG-SCOPED — every user in the org sees every
-- matter. Teams are organizational labels for grouping users (and a hook for
-- future per-team matter visibility scoping). The signup trigger is extended
-- to honor `lc_invitations.team_id` when the invitee accepts, adding them
-- to the specified team automatically.
-- ============================================================================

create extension if not exists pgcrypto;

-- ── lc_teams ────────────────────────────────────────────────────────────────
create table if not exists lc_teams (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references lc_organizations(id) on delete cascade,
  name        text not null,
  description text,
  created_at  timestamptz not null default now(),
  created_by  uuid references auth.users(id) on delete set null,
  unique (org_id, name)
);
create index if not exists lc_teams_org_idx on lc_teams(org_id);

comment on table  lc_teams is 'Sub-groups of users within an organization (practice groups, matter groups).';

-- ── lc_team_memberships ─────────────────────────────────────────────────────
create table if not exists lc_team_memberships (
  team_id   uuid not null references lc_teams(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  added_at  timestamptz not null default now(),
  added_by  uuid references auth.users(id) on delete set null,
  primary key (team_id, user_id)
);
create index if not exists lc_team_memberships_user_idx on lc_team_memberships(user_id);

comment on table lc_team_memberships is 'Which users are in which sub-team.';

-- ── lc_invitations.team_id — optional team to add invitee to on accept ─────
alter table lc_invitations
  add column if not exists team_id uuid references lc_teams(id) on delete set null;

comment on column lc_invitations.team_id is
  'If set, invitee is added to this team automatically when they accept the invite.';

-- ── RLS ─────────────────────────────────────────────────────────────────────
alter table lc_teams              enable row level security;
alter table lc_team_memberships   enable row level security;

-- Anyone in the org can SEE teams in their org
drop policy if exists "lc_teams org read" on lc_teams;
create policy "lc_teams org read" on lc_teams
  for select using (org_id = lc_user_org());

-- Only org admins can write
drop policy if exists "lc_teams admin write" on lc_teams;
create policy "lc_teams admin write" on lc_teams
  for all
  using (
    org_id = lc_user_org()
    and exists (select 1 from lc_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    org_id = lc_user_org()
    and exists (select 1 from lc_profiles where id = auth.uid() and role = 'admin')
  );

-- Memberships: anyone in the org can read; only admins can write
drop policy if exists "lc_team_memberships org read" on lc_team_memberships;
create policy "lc_team_memberships org read" on lc_team_memberships
  for select using (
    team_id in (select id from lc_teams where org_id = lc_user_org())
  );

drop policy if exists "lc_team_memberships admin write" on lc_team_memberships;
create policy "lc_team_memberships admin write" on lc_team_memberships
  for all
  using (
    team_id in (select id from lc_teams where org_id = lc_user_org())
    and exists (select 1 from lc_profiles where id = auth.uid() and role = 'admin')
  )
  with check (
    team_id in (select id from lc_teams where org_id = lc_user_org())
    and exists (select 1 from lc_profiles where id = auth.uid() and role = 'admin')
  );

-- ── Extend signup trigger to add invitee to invitation's team (if any) ──────
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
    -- Invited signup → join existing org with the role from the invitation
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
      org_id                     = excluded.org_id,
      role                       = excluded.role,
      disclaimer_acknowledged_at = coalesce(lc_profiles.disclaimer_acknowledged_at, excluded.disclaimer_acknowledged_at),
      disclaimer_version         = coalesce(lc_profiles.disclaimer_version,         excluded.disclaimer_version);

    update lc_invitations
       set accepted_at = now(),
           accepted_by = new.id
     where id = invite.id;

    -- If the invitation targeted a specific team, add the new user to it.
    if invite.team_id is not null then
      insert into lc_team_memberships (team_id, user_id, added_by)
      values (invite.team_id, new.id, invite.invited_by)
      on conflict (team_id, user_id) do nothing;
    end if;
  else
    -- Standard new-org signup (first user is admin)
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
