-- ============================================================================
-- Migration 002 — tower-aware allocation fields
--
-- Adds columns the analyzer uses to model coverage as a layered tower
-- (primary / umbrella / excess) instead of flattening everything into a single
-- pro-rata pool.
-- ============================================================================

-- lc_analyses — narrative + first-dollar retention
alter table lc_analyses
  add column if not exists insured_retention   numeric,    -- $ paid by insured before any insurance attaches
  add column if not exists tower_explanation   text;       -- short prose describing the layer structure

-- lc_analysis_results — per-carrier layer placement
alter table lc_analysis_results
  add column if not exists layer              text check (layer in ('primary','umbrella','excess','self_insured') or layer is null),
  add column if not exists attachment_point   numeric,     -- $ of underlying coverage required before this layer attaches
  add column if not exists applicable_limit   numeric;     -- this policy's per-occurrence or aggregate cap as used in this analysis
