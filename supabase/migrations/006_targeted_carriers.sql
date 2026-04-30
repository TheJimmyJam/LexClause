-- ============================================================================
-- Migration 006 — structured targeted_carriers on lc_matters
--
-- Replaces relying on matter.description free-text to signal selective tender.
-- When the matter has a non-empty targeted_carriers array, the analysis engine
-- (and the validator) treat any policy NOT in the array as a $0 allocation
-- under Illinois (and other targeted-tender) doctrine.
--
-- Empty/null array means no targeted tender — fall back to the state default.
-- ============================================================================

alter table lc_matters
  add column if not exists targeted_carriers uuid[] default '{}'::uuid[];

comment on column lc_matters.targeted_carriers is
  'Array of lc_policies.id values the insured has selectively tendered to. Empty = no targeted tender. Used by IL (John Burns / Kajima) and other targeted-tender jurisdictions.';
