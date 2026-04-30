-- ============================================================================
-- LexClause — initial schema (migration 001)
--
-- Standalone schema. LexClause owns its own organizations, profiles, policies,
-- matters, analyses, and state-law catalog. Every app table is gated by
-- lc_user_org() which returns the caller's org_id from lc_profiles.
--
-- Run this in the Supabase SQL editor. Idempotent where reasonable.
-- ============================================================================

-- ── Required extension ──
create extension if not exists "pgcrypto";  -- for gen_random_uuid()

-- ============================================================================
-- lc_organizations — top-level tenant
-- ============================================================================
create table if not exists lc_organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================================
-- lc_profiles — one row per user, links auth.users to an organization
-- ============================================================================
create table if not exists lc_profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  org_id       uuid references lc_organizations(id) on delete cascade,
  email        text,
  first_name   text,
  last_name    text,
  role         text not null default 'member' check (role in ('admin','member','viewer')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists lc_profiles_org_idx on lc_profiles(org_id);

-- ── Helper: lc_user_org() returns the caller's org_id from lc_profiles ──
create or replace function lc_user_org() returns uuid
language sql stable security definer set search_path = public as $$
  select org_id from lc_profiles where id = auth.uid()
$$;

-- ── Auth signup trigger ────────────────────────────────────────────────────
-- When a new auth.users row is created, auto-create the user's organization
-- (named from raw_user_meta_data.org_name, falling back to the email's local
-- part) and then a lc_profiles row pointing at it.
create or replace function public.handle_new_lexclause_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  new_org_id uuid;
  org_label  text;
  fname      text;
  lname      text;
begin
  org_label := coalesce(
    nullif(new.raw_user_meta_data->>'org_name', ''),
    split_part(new.email, '@', 1)
  );
  fname := nullif(new.raw_user_meta_data->>'first_name', '');
  lname := nullif(new.raw_user_meta_data->>'last_name',  '');

  insert into lc_organizations (name) values (org_label)
  returning id into new_org_id;

  insert into lc_profiles (id, org_id, email, first_name, last_name, role)
  values (new.id, new_org_id, new.email, fname, lname, 'admin')
  on conflict (id) do update
    set email      = excluded.email,
        first_name = coalesce(excluded.first_name, lc_profiles.first_name),
        last_name  = coalesce(excluded.last_name,  lc_profiles.last_name),
        org_id     = coalesce(lc_profiles.org_id, excluded.org_id);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_lexclause on auth.users;
create trigger on_auth_user_created_lexclause
  after insert on auth.users
  for each row execute function public.handle_new_lexclause_user();

-- ============================================================================
-- lc_policies — the policy library
-- ============================================================================
create table if not exists lc_policies (
  id                          uuid primary key default gen_random_uuid(),
  org_id                      uuid not null references lc_organizations(id) on delete cascade,
  created_by                  uuid references auth.users(id),
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  -- Source artifact
  source_filename             text,
  source_storage_path         text,           -- lc-policies bucket key
  source_text                 text,           -- raw extracted text (cached)

  -- Identity
  carrier                     text,
  policy_number               text,
  named_insured               text,
  additional_insureds         jsonb default '[]'::jsonb,

  -- Period
  effective_date              date,
  expiration_date             date,

  -- Jurisdiction
  state_issued                text check (char_length(state_issued) = 2 or state_issued is null),

  -- Form
  policy_form                 text,           -- CGL_OCCURRENCE | CGL_CLAIMS_MADE | UMBRELLA | EXCESS | D&O | PROFESSIONAL | OTHER

  -- Limits & retentions (USD)
  per_occurrence_limit        numeric,
  general_aggregate           numeric,
  products_aggregate          numeric,
  self_insured_retention      numeric,
  deductible                  numeric,
  attachment_point            numeric,        -- excess/umbrella

  -- Coverage-share language (the decision drivers)
  other_insurance_clause      text,
  other_insurance_type        text,           -- PRIMARY | EXCESS | PRO_RATA | ESCAPE | EXCESS_OVER_OTHER | SILENT
  allocation_method_text      text,

  -- Flags identified by extraction
  has_anti_stacking_clause           boolean default false,
  has_non_cumulation_clause          boolean default false,
  has_prior_acts_exclusion           boolean default false,
  has_known_loss_exclusion           boolean default false,
  has_continuous_trigger_endorsement boolean default false,

  -- Extraction lifecycle
  extraction_status           text default 'pending' check (extraction_status in ('pending','extracting','complete','failed')),
  extraction_error            text,
  extracted_at                timestamptz,
  raw_extraction              jsonb           -- full Claude response, for re-deriving fields later
);
create index if not exists lc_policies_org_idx     on lc_policies(org_id);
create index if not exists lc_policies_carrier_idx on lc_policies(org_id, carrier);
create index if not exists lc_policies_period_idx  on lc_policies(org_id, effective_date, expiration_date);

-- ============================================================================
-- lc_policy_endorsements — list of endorsements per policy
-- ============================================================================
create table if not exists lc_policy_endorsements (
  id              uuid primary key default gen_random_uuid(),
  policy_id       uuid not null references lc_policies(id) on delete cascade,
  endorsement_no  text,
  label           text,
  text            text,
  effect          text,          -- BROADENS | RESTRICTS | NEUTRAL
  created_at      timestamptz not null default now()
);
create index if not exists lc_policy_endorsements_policy_idx on lc_policy_endorsements(policy_id);

-- ============================================================================
-- lc_policy_exclusions — list of exclusions per policy
-- ============================================================================
create table if not exists lc_policy_exclusions (
  id          uuid primary key default gen_random_uuid(),
  policy_id   uuid not null references lc_policies(id) on delete cascade,
  label       text,
  text        text,
  created_at  timestamptz not null default now()
);
create index if not exists lc_policy_exclusions_policy_idx on lc_policy_exclusions(policy_id);

-- ============================================================================
-- lc_matters — coverage matters
-- ============================================================================
create table if not exists lc_matters (
  id                     uuid primary key default gen_random_uuid(),
  org_id                 uuid not null references lc_organizations(id) on delete cascade,
  created_by             uuid references auth.users(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),

  name                   text not null,
  description            text,

  loss_type              text,
  loss_start_date        date,
  loss_end_date          date,
  damages_exposure       numeric,

  -- Jurisdictions
  venue_state            text,                   -- where suit is filed / loss venued
  insured_hq_state       text,
  loss_location_states   text[] default '{}'::text[],
  governing_state        text,                   -- chosen controlling law

  -- Trigger override
  trigger_theory         text                    -- exposure | manifestation | continuous_trigger | injury_in_fact | actual_injury
);
create index if not exists lc_matters_org_idx on lc_matters(org_id);

-- ============================================================================
-- lc_matter_policies — which policies are in play for a matter
-- ============================================================================
create table if not exists lc_matter_policies (
  matter_id  uuid not null references lc_matters(id)  on delete cascade,
  policy_id  uuid not null references lc_policies(id) on delete cascade,
  role       text not null default 'subject',  -- 'subject' | 'reference' | 'excluded'
  notes      text,
  primary key (matter_id, policy_id)
);
create index if not exists lc_matter_policies_policy_idx on lc_matter_policies(policy_id);

-- ============================================================================
-- lc_analyses — each run of the allocation engine
-- ============================================================================
create table if not exists lc_analyses (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references lc_organizations(id) on delete cascade,
  matter_id           uuid not null references lc_matters(id) on delete cascade,
  created_by          uuid references auth.users(id),
  created_at          timestamptz not null default now(),

  governing_state     text,
  trigger_theory      text,
  allocation_method   text,

  total_amount        numeric,                  -- exposure used as input
  status              text default 'pending' check (status in ('pending','running','complete','failed')),
  error               text,

  methodology_text    text,                     -- prose explanation, citations
  raw_engine_output   jsonb                     -- full engine result, for audit
);
create index if not exists lc_analyses_matter_idx on lc_analyses(matter_id);

-- ============================================================================
-- lc_analysis_results — per-policy share rows for an analysis
-- ============================================================================
create table if not exists lc_analysis_results (
  id                  uuid primary key default gen_random_uuid(),
  analysis_id         uuid not null references lc_analyses(id) on delete cascade,
  policy_id           uuid references lc_policies(id) on delete set null,

  -- Snapshot of the policy at the time of analysis (so we can recompute later)
  carrier             text,
  policy_number       text,
  policy_effective    date,
  policy_expiration   date,
  policy_state_issued text,

  share_pct           numeric,                  -- 0..1
  allocated_amount    numeric,                  -- USD share
  rationale           text,                     -- short explanation
  ordering            int                       -- display order
);
create index if not exists lc_analysis_results_analysis_idx on lc_analysis_results(analysis_id);

-- ============================================================================
-- lc_state_law_rules — overrideable state-law catalogue (mirrors stateLaw.js)
-- Lets you tweak rules without redeploying the frontend.
-- ============================================================================
create table if not exists lc_state_law_rules (
  state_code              text primary key check (char_length(state_code) = 2),
  name                    text not null,
  default_method          text not null,
  default_trigger         text,
  horizontal_exhaustion   boolean default false,
  targeted_tender_allowed boolean default false,
  notes                   text,
  citations               jsonb default '[]'::jsonb,
  updated_at              timestamptz not null default now()
);

-- Seed (mirrors frontend stateLaw.js — keep in sync when you change either)
insert into lc_state_law_rules (state_code, name, default_method, default_trigger, horizontal_exhaustion, targeted_tender_allowed, notes) values
  ('CA','California','all_sums','continuous_trigger',false,false,'Continuous trigger; all-sums with right of contribution. Montrose I & II.'),
  ('NJ','New Jersey','pro_rata_time_on_risk','continuous_trigger',true,false,'Owens-Illinois pro-rata-by-time-and-limits. Continuous trigger.'),
  ('NY','New York','pro_rata_time_on_risk','injury_in_fact',true,false,'Pro-rata-by-time-on-risk. Strict horizontal exhaustion (Viking Pump narrow exception).'),
  ('IL','Illinois','targeted_tender','continuous_trigger',false,true,'Selective-tender state — insured may pick its carrier.'),
  ('MA','Massachusetts','pro_rata_time_on_risk','continuous_trigger',true,false,'Pro-rata-by-years-of-coverage default.'),
  ('PA','Pennsylvania','pro_rata_time_on_risk','manifestation',true,false,'Generally first-manifestation trigger; pro-rata across triggered periods.'),
  ('TX','Texas','pro_rata_by_limits','actual_injury',false,false,'Eight-corners and actual-injury rule.'),
  ('FL','Florida','pro_rata_time_on_risk','injury_in_fact',true,false,'Trigger varies by claim type; pro-rata predominates in long-tail.'),
  ('WA','Washington','all_sums','continuous_trigger',false,false,'All-sums with insured choice of any triggered policy.'),
  ('OH','Ohio','all_sums','continuous_trigger',false,false,'All-sums under Goodyear; insured may pick any triggered carrier.')
on conflict (state_code) do nothing;

-- ============================================================================
-- updated_at trigger helper
-- ============================================================================
create or replace function lc_set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists lc_orgs_set_updated     on lc_organizations;
create trigger lc_orgs_set_updated     before update on lc_organizations for each row execute function lc_set_updated_at();

drop trigger if exists lc_profiles_set_updated on lc_profiles;
create trigger lc_profiles_set_updated before update on lc_profiles for each row execute function lc_set_updated_at();

drop trigger if exists lc_policies_set_updated on lc_policies;
create trigger lc_policies_set_updated before update on lc_policies for each row execute function lc_set_updated_at();

drop trigger if exists lc_matters_set_updated  on lc_matters;
create trigger lc_matters_set_updated  before update on lc_matters  for each row execute function lc_set_updated_at();

-- ============================================================================
-- RLS — gate everything by the caller's lc_profiles.org_id
-- ============================================================================
alter table lc_organizations         enable row level security;
alter table lc_profiles              enable row level security;
alter table lc_policies              enable row level security;
alter table lc_policy_endorsements   enable row level security;
alter table lc_policy_exclusions     enable row level security;
alter table lc_matters               enable row level security;
alter table lc_matter_policies       enable row level security;
alter table lc_analyses              enable row level security;
alter table lc_analysis_results      enable row level security;
alter table lc_state_law_rules       enable row level security;

-- lc_organizations — caller can only read/update their own org
drop policy if exists lc_orgs_select on lc_organizations;
drop policy if exists lc_orgs_update on lc_organizations;
create policy lc_orgs_select on lc_organizations for select using (id = lc_user_org());
create policy lc_orgs_update on lc_organizations for update
  using (id = lc_user_org())
  with check (id = lc_user_org());

-- lc_profiles — caller can read/update their own profile + others in same org (read-only)
drop policy if exists lc_profiles_select  on lc_profiles;
drop policy if exists lc_profiles_self    on lc_profiles;
create policy lc_profiles_select on lc_profiles for select
  using (id = auth.uid() or org_id = lc_user_org());
create policy lc_profiles_self on lc_profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- lc_policies
drop policy if exists lc_policies_select on lc_policies;
drop policy if exists lc_policies_modify on lc_policies;
create policy lc_policies_select on lc_policies for select using (org_id = lc_user_org());
create policy lc_policies_modify on lc_policies for all
  using (org_id = lc_user_org())
  with check (org_id = lc_user_org());

-- lc_policy_endorsements (gated through parent policy's org)
drop policy if exists lc_endors_select on lc_policy_endorsements;
drop policy if exists lc_endors_modify on lc_policy_endorsements;
create policy lc_endors_select on lc_policy_endorsements for select
  using (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()));
create policy lc_endors_modify on lc_policy_endorsements for all
  using (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()))
  with check (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()));

-- lc_policy_exclusions
drop policy if exists lc_excl_select on lc_policy_exclusions;
drop policy if exists lc_excl_modify on lc_policy_exclusions;
create policy lc_excl_select on lc_policy_exclusions for select
  using (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()));
create policy lc_excl_modify on lc_policy_exclusions for all
  using (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()))
  with check (exists (select 1 from lc_policies p where p.id = policy_id and p.org_id = lc_user_org()));

-- lc_matters
drop policy if exists lc_matters_select on lc_matters;
drop policy if exists lc_matters_modify on lc_matters;
create policy lc_matters_select on lc_matters for select using (org_id = lc_user_org());
create policy lc_matters_modify on lc_matters for all
  using (org_id = lc_user_org())
  with check (org_id = lc_user_org());

-- lc_matter_policies
drop policy if exists lc_mp_select on lc_matter_policies;
drop policy if exists lc_mp_modify on lc_matter_policies;
create policy lc_mp_select on lc_matter_policies for select
  using (exists (select 1 from lc_matters m where m.id = matter_id and m.org_id = lc_user_org()));
create policy lc_mp_modify on lc_matter_policies for all
  using (exists (select 1 from lc_matters m where m.id = matter_id and m.org_id = lc_user_org()))
  with check (exists (select 1 from lc_matters m where m.id = matter_id and m.org_id = lc_user_org()));

-- lc_analyses
drop policy if exists lc_analyses_select on lc_analyses;
drop policy if exists lc_analyses_modify on lc_analyses;
create policy lc_analyses_select on lc_analyses for select using (org_id = lc_user_org());
create policy lc_analyses_modify on lc_analyses for all
  using (org_id = lc_user_org())
  with check (org_id = lc_user_org());

-- lc_analysis_results (gated through parent analysis's org)
drop policy if exists lc_results_select on lc_analysis_results;
drop policy if exists lc_results_modify on lc_analysis_results;
create policy lc_results_select on lc_analysis_results for select
  using (exists (select 1 from lc_analyses a where a.id = analysis_id and a.org_id = lc_user_org()));
create policy lc_results_modify on lc_analysis_results for all
  using (exists (select 1 from lc_analyses a where a.id = analysis_id and a.org_id = lc_user_org()))
  with check (exists (select 1 from lc_analyses a where a.id = analysis_id and a.org_id = lc_user_org()));

-- lc_state_law_rules — readable to everyone, mutable by service_role only
drop policy if exists lc_state_rules_select on lc_state_law_rules;
create policy lc_state_rules_select on lc_state_law_rules for select using (true);

-- ============================================================================
-- Storage bucket for policy PDFs
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('lc-policies', 'lc-policies', false)
on conflict (id) do nothing;

-- Storage RLS — only org members can read/write their org's path prefix.
-- Files are stored at: <org_id>/<timestamp>-<filename>
drop policy if exists "lc-policies read"   on storage.objects;
drop policy if exists "lc-policies write"  on storage.objects;
create policy "lc-policies read" on storage.objects for select
  using (
    bucket_id = 'lc-policies'
    and (storage.foldername(name))[1]::uuid = lc_user_org()
  );
create policy "lc-policies write" on storage.objects for insert
  with check (
    bucket_id = 'lc-policies'
    and (storage.foldername(name))[1]::uuid = lc_user_org()
  );

-- ============================================================================
-- Done. Next steps in Supabase:
--   1. Run this migration in SQL Editor.
--   2. Create Edge Function `analyze-policy` (see /supabase/functions/analyze-policy/index.ts).
--   3. Set ANTHROPIC_API_KEY secret on the Edge Function.
-- ============================================================================
