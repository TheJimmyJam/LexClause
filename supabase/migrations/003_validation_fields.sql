-- ============================================================================
-- Migration 003 — validation fields on lc_analyses
--
-- The allocation engine post-validates Claude's output against arithmetic
-- invariants (sum equals exposure, per-row allocated <= applicable limit).
-- These columns capture the result of that validation, including any retry
-- attempts made to self-correct.
-- ============================================================================

alter table lc_analyses
  add column if not exists validation_status   text check (validation_status in ('valid','needs_review','not_run') or validation_status is null),
  add column if not exists validation_errors   jsonb,    -- array of {type, message, carrier?, policy_number?} entries
  add column if not exists validation_attempts int default 0;
