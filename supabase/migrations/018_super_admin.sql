-- ============================================================================
-- Migration 018 — super admin / "god mode" for LexClause operators
--
-- Creates a small mechanism letting designated user accounts (the LexClause
-- founders / operators) see every organization, user, matter, and analysis in
-- the system — for support, audit, and sales-led customer onboarding.
--
-- This is ORTHOGONAL to org admin role: a super admin is identified by their
-- presence in `lc_super_admins`. They keep their own org membership and use
-- the app like any other user; super admin rights only fire when their
-- queries are not org-scoped (e.g. on the /admin operator console).
--
-- Existing org-scoped RLS policies are NOT modified. Postgres combines RLS
-- policies with OR — a new "super admin all" policy on each lc_ table is
-- additive, so members keep org-scoped visibility and super admins gain
-- cross-org access on the same row.
--
-- Auto-promotion: anyone who signs up with one of the bootstrap emails
-- (wcannon83@gmail.com, masonwm1@gmail.com) is automatically inserted into
-- lc_super_admins. Existing rows with those emails are seeded immediately.
-- ============================================================================

-- ── lc_super_admins ─────────────────────────────────────────────────────────
create table if not exists lc_super_admins (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  granted_at  timestamptz not null default now(),
  granted_by  uuid references auth.users(id) on delete set null,
  notes       text
);

comment on table lc_super_admins is
  'LexClause operators with cross-org god-mode visibility. Membership is global, not per-org.';

-- ── is_super_admin() helper ─────────────────────────────────────────────────
create or replace function public.is_super_admin()
  returns boolean
  language sql
  stable
  security definer
  set search_path to 'public'
as $$
  select exists (select 1 from lc_super_admins where user_id = auth.uid())
$$;

comment on function public.is_super_admin() is
  'Returns true if the current authenticated user is in lc_super_admins. Used in additive RLS policies on every org-scoped table.';

-- ── lc_super_admins RLS — only super admins can read/write the list ─────────
alter table lc_super_admins enable row level security;

drop policy if exists "lc_super_admins self read" on lc_super_admins;
create policy "lc_super_admins self read" on lc_super_admins
  for select using (is_super_admin());

drop policy if exists "lc_super_admins self write" on lc_super_admins;
create policy "lc_super_admins self write" on lc_super_admins
  for all
  using  (is_super_admin())
  with check (is_super_admin());

-- ── Additive cross-org policies on every org-scoped table ──────────────────
-- Existing per-table policies (org_id = lc_user_org() etc.) remain intact.
-- These additional policies only grant access to super admins.
do $$
declare tbl text;
begin
  for tbl in
    select unnest(array[
      'lc_organizations',
      'lc_profiles',
      'lc_policies',
      'lc_policy_endorsements',
      'lc_policy_exclusions',
      'lc_matters',
      'lc_matter_policies',
      'lc_analyses',
      'lc_analysis_results',
      'lc_invitations',
      'lc_teams',
      'lc_team_memberships'
    ])
  loop
    execute format('drop policy if exists "lc_super_admin all" on %I', tbl);
    execute format(
      'create policy "lc_super_admin all" on %I for all using (is_super_admin()) with check (is_super_admin())',
      tbl
    );
  end loop;
end $$;

-- ── Auto-promote bootstrap emails ───────────────────────────────────────────
-- Two known operator emails are promoted to super admin automatically. Adding
-- another operator later: just INSERT INTO lc_super_admins manually (or extend
-- the auto-promote list below).
create or replace function public.auto_promote_super_admin()
  returns trigger
  language plpgsql
  security definer
  set search_path to 'public'
as $function$
begin
  if lower(coalesce(new.email,'')) in ('wcannon83@gmail.com','masonwm1@gmail.com') then
    insert into lc_super_admins (user_id, notes)
      values (new.id, 'Auto-promoted on signup (bootstrap operator)')
      on conflict (user_id) do nothing;
  end if;
  return new;
end;
$function$;

drop trigger if exists auto_promote_super_admin_on_insert on auth.users;
create trigger auto_promote_super_admin_on_insert
  after insert on auth.users
  for each row
  execute function public.auto_promote_super_admin();

-- ── Seed existing users ─────────────────────────────────────────────────────
insert into lc_super_admins (user_id, notes)
select id, 'Seeded by migration 018 (bootstrap operator)'
  from auth.users
 where lower(email) in ('wcannon83@gmail.com','masonwm1@gmail.com')
on conflict (user_id) do nothing;
