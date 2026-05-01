-- ============================================================================
-- Migration 011 — coverage priority schema
--
-- Pivots LexClause from dollar-allocation analysis (legacy ALLOCATE mode) to
-- coverage-priority analysis (COVERAGE_PRIORITY mode). Adds the columns the
-- new engine needs for: separated trigger/priority/exhaustion narratives and
-- citation arrays on lc_state_law_rules; opinion-shape fields on lc_analyses;
-- per-policy trigger findings + priority ranks on lc_analysis_results; and
-- structured allegations on lc_matters.
--
-- Old dollar-allocation columns are preserved for backward compatibility so
-- existing analyses survive the migration. New analyses default to
-- mode='coverage_priority' once the engine is updated.
-- ============================================================================

-- ── lc_state_law_rules: separated narratives + citation arrays ──────────────
-- The old `notes` (text) and `citations` (jsonb) columns lumped everything
-- together. Coverage priority needs three separate dimensions: the trigger /
-- duty-to-defend test, the Other-Insurance / priority rule, and the
-- exhaustion rule. Each gets its own narrative + citation array so the engine
-- can pin authority by section without cross-citing.
alter table lc_state_law_rules
  add column if not exists trigger_test            text,
  add column if not exists trigger_citations       jsonb default '[]'::jsonb,
  add column if not exists priority_rule           text,
  add column if not exists priority_citations      jsonb default '[]'::jsonb,
  add column if not exists exhaustion_rule_text    text,
  add column if not exists exhaustion_citations    jsonb default '[]'::jsonb;

alter table lc_state_law_rules
  add constraint lc_state_law_rules_exhaustion_rule_text_check
  check (exhaustion_rule_text in ('vertical','horizontal','mixed','undetermined') or exhaustion_rule_text is null);

comment on column lc_state_law_rules.trigger_test is
  'Narrative description of the state''s duty-to-defend / trigger test (eight-corners, four-corners, potentiality of coverage with extrinsic evidence, etc.). Sourced via Hinshaw-style research.';
comment on column lc_state_law_rules.trigger_citations is
  'Vetted citations for the trigger test. Used by the engine ONLY for the trigger section of the opinion.';
comment on column lc_state_law_rules.priority_rule is
  'Narrative description of how the state resolves Other-Insurance priority among multiple triggered policies (mutually-repugnant pro-rata, closest-to-the-risk, specific-over-general, targeted tender, etc.).';
comment on column lc_state_law_rules.priority_citations is
  'Vetted citations for the priority rule. Used by the engine ONLY for the priority section.';
comment on column lc_state_law_rules.exhaustion_rule_text is
  'Either ''vertical'', ''horizontal'', ''mixed'', or ''undetermined''. Surfaced as a labeled section of every coverage-priority opinion.';
comment on column lc_state_law_rules.exhaustion_citations is
  'Vetted citations for the exhaustion rule. Used by the engine ONLY for the exhaustion section.';

-- ── lc_analyses: support coverage_priority mode + new opinion shape ─────────
alter table lc_analyses
  add column if not exists mode                      text default 'allocation',
  add column if not exists narrative                 text,
  add column if not exists priority_rule_applied     text,
  add column if not exists priority_rule_citation    text,
  add column if not exists exhaustion_rule           text,
  add column if not exists exhaustion_rule_citation  text,
  add column if not exists mutually_repugnant_groups jsonb;

alter table lc_analyses
  add constraint lc_analyses_mode_check
  check (mode in ('allocation','coverage_priority'));

alter table lc_analyses
  add constraint lc_analyses_exhaustion_rule_check
  check (exhaustion_rule in ('vertical','horizontal','mixed','undetermined') or exhaustion_rule is null);

comment on column lc_analyses.mode is
  'Either ''allocation'' (legacy dollar-apportionment output) or ''coverage_priority'' (trigger/priority/exhaustion opinion). New analyses default to coverage_priority once the engine is migrated.';
comment on column lc_analyses.narrative is
  'Replaces methodology_text for coverage_priority mode. 2-3 paragraph opinion-style summary tying allegations -> triggered policies -> priority order -> exhaustion rule.';

create index if not exists lc_analyses_mode_idx on lc_analyses(mode);

-- ── lc_analysis_results: per-policy trigger + priority data ─────────────────
-- Old dollar columns (layer, attachment_point, applicable_limit, share_pct,
-- allocated_amount) stay nullable for backward compatibility. New columns
-- capture trigger findings and priority rank for coverage_priority mode.
alter table lc_analysis_results
  add column if not exists triggered                          text,
  add column if not exists allegations_implicating_coverage   jsonb default '[]'::jsonb,
  add column if not exists coverage_grant_basis               text,
  add column if not exists exclusions_considered              jsonb default '[]'::jsonb,
  add column if not exists trigger_rationale                  text,
  add column if not exists priority_rank                      text,
  add column if not exists priority_rank_basis                text,
  add column if not exists other_insurance_quote              text;

alter table lc_analysis_results
  add constraint lc_analysis_results_triggered_check
  check (triggered in ('yes','no','partial') or triggered is null);

alter table lc_analysis_results
  add constraint lc_analysis_results_priority_rank_check
  check (priority_rank in ('primary','co-primary','excess','sub-excess') or priority_rank is null);

-- Loosen the layer check on the legacy column — old values still allowed,
-- but new coverage_priority rows leave layer null.
-- (no change needed; the original constraint already permits null.)

comment on column lc_analysis_results.triggered is
  'Trigger / duty-to-defend finding for this (analysis, policy) pair: yes (every implicating allegation survives exclusions), no (none survive), partial (mixed claim).';
comment on column lc_analysis_results.priority_rank is
  'Priority rank among triggered policies: primary | co-primary | excess | sub-excess.';

-- ── lc_matters: structured allegations from the trigger document ────────────
-- The matter intake flow extracts allegations from a complaint, petition,
-- pre-suit demand, ROR, or claim summary and writes them here. Each entry is
-- {count, theory_of_liability, conduct_alleged, harm_type}.
alter table lc_matters
  add column if not exists allegations jsonb default '[]'::jsonb;

comment on column lc_matters.allegations is
  'Array of structured allegations extracted from the underlying trigger document. Shape per entry: {count, theory_of_liability, conduct_alleged, harm_type}. Drives the trigger analysis in coverage_priority mode.';
