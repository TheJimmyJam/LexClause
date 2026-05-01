/**
 * Policy analysis client — talks to the Claude API via a Supabase Edge Function.
 *
 * The frontend NEVER holds an Anthropic API key. We invoke an Edge Function
 * (`analyze-policy`) that holds ANTHROPIC_API_KEY in its server env, calls
 * Claude with a structured-output prompt, and writes the parsed result back
 * into lc_policy_terms / lc_analysis_results.
 *
 * Frontend role: upload PDFs, kick off analyses, poll/display results.
 */

import { supabase } from './supabase.js'

/** Trigger an extraction job for a single uploaded policy PDF. */
export async function extractPolicyTerms(policyId) {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: { policyId, mode: 'extract_terms' },
  })
  if (error) throw error
  return data
}

/** Pull matter-intake fields out of an FNOL/ROR/claim-summary PDF.
 *  Pass the storagePath (already uploaded to lc-matter-docs).
 *  Returns { parsed: { matter_name, named_insured, loss_type, ... }, storagePath }.
 */
export async function extractMatterFromDocument(storagePath) {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: { mode: 'extract_matter', storagePath },
  })
  if (error) throw error
  return data
}

/** Run the multi-policy / multi-state allocation analysis for a matter. */
export async function runAllocationAnalysis(matterId, opts = {}) {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: {
      matterId,
      mode: 'allocate',
      governingStateOverride: opts.governingState || null,
      triggerTheoryOverride:  opts.triggerTheory  || null,
    },
  })
  if (error) throw error
  return data
}

/**
 * Run N parallel allocations under different governing states. Returns
 * { comparisonGroupId, analysisIds }. Frontend navigates to the comparison
 * page which polls all N rows until each is complete.
 */
export async function runComparison(matterId, states, opts = {}) {
  if (!Array.isArray(states) || states.length < 2) {
    throw new Error('runComparison requires at least 2 states')
  }
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: {
      matterId,
      mode: 'allocate',
      comparisonStates: states,
      triggerTheoryOverride: opts.triggerTheory || null,
    },
  })
  if (error) throw error
  return data
}

// ────────────────────────────────────────────────────────────────────────────
// v0.3 — coverage priority engine
// ────────────────────────────────────────────────────────────────────────────

/** Auto-classify an uploaded PDF. Returns { kind, policy_form, venue_state, confidence, summary }. */
export async function classifyDocument(storagePath, bucket = 'lc-matter-docs') {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: { mode: 'classify_document', storagePath, bucket },
  })
  if (error) throw error
  return data?.parsed
}

/** Extract structured allegations from a complaint / demand / ROR / claim summary.
 *  If `matterId` is provided, the engine writes allegations + facts back to lc_matters.
 */
export async function extractAllegations(storagePath, matterId = null) {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: { mode: 'extract_allegations', storagePath, matterId },
  })
  if (error) throw error
  return data?.parsed
}

/** Run the coverage_priority engine for a matter. Returns { analysisId, status }. */
export async function runCoveragePriority(matterId, opts = {}) {
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: {
      mode: 'coverage_priority',
      matterId,
      governingStateOverride: opts.governingState || null,
    },
  })
  if (error) throw error
  return data
}

/** Run coverage_priority across multiple states in parallel. Returns { comparisonGroupId, analysisIds }. */
export async function runCoveragePriorityComparison(matterId, states) {
  if (!Array.isArray(states) || states.length < 2) {
    throw new Error('runCoveragePriorityComparison requires at least 2 states')
  }
  const { data, error } = await supabase.functions.invoke('analyze-policy', {
    body: {
      mode: 'coverage_priority',
      matterId,
      comparisonStates: states,
    },
  })
  if (error) throw error
  return data
}

/**
 * What we expect Claude to extract from each policy. Documented here so the
 * Edge Function prompt + the database column shapes can stay in sync.
 */
export const POLICY_EXTRACTION_SHAPE = {
  carrier:           '',     // string — issuing carrier
  policy_number:     '',     // string
  named_insured:     '',     // string
  effective_date:    '',     // ISO date
  expiration_date:   '',     // ISO date
  state_issued:      '',     // 2-letter state code
  policy_form:       '',     // 'CGL_OCCURRENCE' | 'CGL_CLAIMS_MADE' | 'UMBRELLA' | 'EXCESS' | 'D&O' | 'PROFESSIONAL' | 'OTHER'
  per_occurrence_limit:  null,  // number
  general_aggregate:     null,  // number
  products_aggregate:    null,  // number
  self_insured_retention: null, // number
  deductible:             null, // number
  attachment_point:       null, // number — for excess/umbrella

  // The decision-driving language:
  other_insurance_clause: '', // verbatim or close paraphrase
  other_insurance_type:   '', // 'PRIMARY' | 'EXCESS' | 'PRO_RATA' | 'ESCAPE' | 'EXCESS_OVER_OTHER' | 'SILENT'
  allocation_method_text: '', // policy's own allocation language if any

  exclusions:    [],          // array of {label, text}
  endorsements:  [],          // array of {label, number, text}

  // Things flagging analysis cost/risk:
  has_anti_stacking_clause:        false,
  has_non_cumulation_clause:       false,
  has_prior_acts_exclusion:        false,
  has_known_loss_exclusion:        false,
  has_continuous_trigger_endorsement: false,
}
