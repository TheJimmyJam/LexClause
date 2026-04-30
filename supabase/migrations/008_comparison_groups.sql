-- ============================================================================
-- Migration 008 — comparison groups for multi-scenario allocations
--
-- A "comparison" is N analyses that share the same matter + policies but use
-- different governing-state rules. They live in lc_analyses (one row each)
-- and are linked via comparison_group_id. The frontend queries by group id.
-- ============================================================================

alter table lc_analyses
  add column if not exists comparison_group_id uuid;

create index if not exists lc_analyses_comparison_idx
  on lc_analyses(comparison_group_id) where comparison_group_id is not null;
