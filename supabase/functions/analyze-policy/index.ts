// supabase/functions/analyze-policy/index.ts
//
// LexClause Edge Function — handles two modes:
//   1. mode = 'extract_terms' — Claude reads a stored policy PDF and writes
//      structured fields back to pa_policies (+ endorsements/exclusions).
//   2. mode = 'allocate'      — Combines policies, the matter, and state-law
//      rules into an allocation result; writes pa_analyses + pa_analysis_results.
//
// Required Edge Function secrets:
//   ANTHROPIC_API_KEY     — Claude API key
//   SUPABASE_URL          — auto-populated by Supabase
//   SUPABASE_SERVICE_ROLE_KEY — auto-populated by Supabase
//
// This file is a starting skeleton. Tighten the prompts, add token-limit
// handling, and split into helpers as the analysis surface grows.

// @ts-nocheck   // Deno-typed; tsc check disabled for the editor
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!
const SUPABASE_URL      = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY       = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const CLAUDE_MODEL      = Deno.env.get('ANTHROPIC_MODEL') || 'claude-sonnet-4-6'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// ---------- Claude wrappers ---------------------------------------------------

async function claude({ system, messages, max_tokens = 4096 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: {
      'Content-Type':       'application/json',
      'x-api-key':          ANTHROPIC_API_KEY,
      'anthropic-version':  '2023-06-01',
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens, system, messages }),
  })
  if (!r.ok) throw new Error(`Claude error: ${r.status} ${await r.text()}`)
  return await r.json()
}

const EXTRACT_SYSTEM = `You are a senior coverage attorney reading a single insurance policy. Extract structured data and return ONE JSON object that matches this exact shape — no prose, no markdown:

{
  "carrier": string|null,
  "policy_number": string|null,
  "named_insured": string|null,
  "additional_insureds": string[],
  "effective_date": "YYYY-MM-DD"|null,
  "expiration_date": "YYYY-MM-DD"|null,
  "state_issued": "XX"|null,
  "policy_form": "CGL_OCCURRENCE"|"CGL_CLAIMS_MADE"|"UMBRELLA"|"EXCESS"|"D&O"|"PROFESSIONAL"|"OTHER"|null,
  "per_occurrence_limit": number|null,
  "general_aggregate": number|null,
  "products_aggregate": number|null,
  "self_insured_retention": number|null,
  "deductible": number|null,
  "attachment_point": number|null,
  "other_insurance_clause": string|null,
  "other_insurance_type": "PRIMARY"|"EXCESS"|"PRO_RATA"|"ESCAPE"|"EXCESS_OVER_OTHER"|"SILENT"|null,
  "allocation_method_text": string|null,
  "endorsements": [{"endorsement_no": string|null, "label": string, "text": string, "effect": "BROADENS"|"RESTRICTS"|"NEUTRAL"}],
  "exclusions":   [{"label": string, "text": string}],
  "has_anti_stacking_clause": boolean,
  "has_non_cumulation_clause": boolean,
  "has_prior_acts_exclusion": boolean,
  "has_known_loss_exclusion": boolean,
  "has_continuous_trigger_endorsement": boolean
}

Rules:
- Quote other-insurance and allocation language verbatim where possible (it's the operative text).
- For amounts, return integers in USD (no commas, no $).
- If a field isn't in the document, use null. Do NOT guess.
- state_issued: 2-letter postal code. Use the state on the declarations page or on filings; if absent, null.`

const ALLOCATE_SYSTEM = `You are a coverage attorney drafting a methodology memo for a multi-policy allocation. You will be given the matter facts, the relevant policies (already extracted), and the controlling state's allocation rule. Produce ONE JSON object — no prose:

{
  "allocation_method": "pro_rata_time_on_risk"|"pro_rata_by_limits"|"all_sums"|"all_sums_with_reallocation"|"equal_shares"|"targeted_tender"|"undetermined",
  "trigger_theory": "exposure"|"manifestation"|"continuous_trigger"|"injury_in_fact"|"actual_injury"|"undetermined",
  "results": [
    {
      "policy_id": string,
      "carrier": string,
      "policy_number": string,
      "policy_effective": "YYYY-MM-DD",
      "policy_expiration": "YYYY-MM-DD",
      "policy_state_issued": string,
      "share_pct": number,            // 0..1
      "allocated_amount": number,     // USD
      "rationale": string             // ≤2 sentences
    }
  ],
  "methodology_text": string          // 1-3 paragraph memo: trigger choice, allocation method, why this rule applies, citation
}

Rules:
- Sum of share_pct across results must equal 1.0 (within 0.001).
- Sum of allocated_amount must equal the matter's damages_exposure.
- Cite at least one controlling case from the governing state.
- If facts are insufficient (e.g. damages_exposure unknown), set allocation_method = "undetermined" and explain in methodology_text.`

// ---------- Mode handlers -----------------------------------------------------

async function handleExtract(supabase, policyId) {
  const { data: policy, error: pErr } = await supabase.from('pa_policies').select('*').eq('id', policyId).single()
  if (pErr || !policy) throw new Error('Policy not found')

  // Download the PDF text. (For v1 we assume the upstream uploader provides
  // text; for production, pipe the PDF through a parser like pdf-parse or
  // Anthropic's PDF input feature.)
  // TODO: wire real PDF ingestion. For now, error if source_text is empty so
  // the pipeline surfaces the gap.
  if (!policy.source_text) {
    await supabase.from('pa_policies').update({
      extraction_status: 'failed',
      extraction_error:  'No source_text on record. PDF text extraction not yet wired up.',
    }).eq('id', policyId)
    return { ok: false, reason: 'no_source_text' }
  }

  const r = await claude({
    system: EXTRACT_SYSTEM,
    messages: [{ role: 'user', content: policy.source_text.slice(0, 180_000) }],
    max_tokens: 4096,
  })
  const text = r.content?.[0]?.text || ''
  let parsed
  try { parsed = JSON.parse(text) } catch { throw new Error('Claude returned non-JSON: ' + text.slice(0, 200)) }

  const update = {
    carrier:                parsed.carrier,
    policy_number:          parsed.policy_number,
    named_insured:          parsed.named_insured,
    additional_insureds:    parsed.additional_insureds || [],
    effective_date:         parsed.effective_date,
    expiration_date:        parsed.expiration_date,
    state_issued:           parsed.state_issued,
    policy_form:            parsed.policy_form,
    per_occurrence_limit:   parsed.per_occurrence_limit,
    general_aggregate:      parsed.general_aggregate,
    products_aggregate:     parsed.products_aggregate,
    self_insured_retention: parsed.self_insured_retention,
    deductible:             parsed.deductible,
    attachment_point:       parsed.attachment_point,
    other_insurance_clause: parsed.other_insurance_clause,
    other_insurance_type:   parsed.other_insurance_type,
    allocation_method_text: parsed.allocation_method_text,
    has_anti_stacking_clause:           !!parsed.has_anti_stacking_clause,
    has_non_cumulation_clause:          !!parsed.has_non_cumulation_clause,
    has_prior_acts_exclusion:           !!parsed.has_prior_acts_exclusion,
    has_known_loss_exclusion:           !!parsed.has_known_loss_exclusion,
    has_continuous_trigger_endorsement: !!parsed.has_continuous_trigger_endorsement,
    extraction_status: 'complete',
    extraction_error:  null,
    extracted_at:      new Date().toISOString(),
    raw_extraction:    parsed,
  }
  await supabase.from('pa_policies').update(update).eq('id', policyId)

  // Replace endorsements + exclusions
  await supabase.from('pa_policy_endorsements').delete().eq('policy_id', policyId)
  await supabase.from('pa_policy_exclusions').delete().eq('policy_id', policyId)
  if (Array.isArray(parsed.endorsements) && parsed.endorsements.length) {
    await supabase.from('pa_policy_endorsements')
      .insert(parsed.endorsements.map((e) => ({ ...e, policy_id: policyId })))
  }
  if (Array.isArray(parsed.exclusions) && parsed.exclusions.length) {
    await supabase.from('pa_policy_exclusions')
      .insert(parsed.exclusions.map((e) => ({ ...e, policy_id: policyId })))
  }

  return { ok: true, policy_id: policyId }
}

async function handleAllocate(supabase, matterId, opts = {}) {
  const { data: matter } = await supabase
    .from('pa_matters')
    .select('*, pa_matter_policies(policy_id, role, pa_policies(*))')
    .eq('id', matterId)
    .single()
  if (!matter) throw new Error('Matter not found')

  const policies = (matter.pa_matter_policies || []).map((mp) => mp.pa_policies).filter(Boolean)
  const governingState = opts.governingStateOverride || matter.governing_state
  const triggerTheory  = opts.triggerTheoryOverride  || matter.trigger_theory
  if (!governingState) throw new Error('Matter has no governing_state')
  if (!policies.length) throw new Error('Matter has no policies attached')

  const { data: rule } = await supabase.from('pa_state_law_rules').select('*').eq('state_code', governingState).single()

  const userMessage = JSON.stringify({
    matter: {
      name:             matter.name,
      loss_type:        matter.loss_type,
      loss_start_date:  matter.loss_start_date,
      loss_end_date:    matter.loss_end_date,
      damages_exposure: matter.damages_exposure,
      venue_state:      matter.venue_state,
      governing_state:  governingState,
      trigger_theory:   triggerTheory,
    },
    state_rule: rule || null,
    policies: policies.map((p) => ({
      id:                     p.id,
      carrier:                p.carrier,
      policy_number:          p.policy_number,
      effective_date:         p.effective_date,
      expiration_date:        p.expiration_date,
      state_issued:           p.state_issued,
      policy_form:            p.policy_form,
      per_occurrence_limit:   p.per_occurrence_limit,
      general_aggregate:      p.general_aggregate,
      self_insured_retention: p.self_insured_retention,
      attachment_point:       p.attachment_point,
      other_insurance_clause: p.other_insurance_clause,
      other_insurance_type:   p.other_insurance_type,
      allocation_method_text: p.allocation_method_text,
    })),
  })

  // Create the analysis row up front so we have an id to return / write to
  const { data: analysis, error: aErr } = await supabase
    .from('pa_analyses')
    .insert({
      org_id:           matter.org_id,
      matter_id:        matterId,
      governing_state:  governingState,
      trigger_theory:   triggerTheory,
      total_amount:     matter.damages_exposure,
      status:           'running',
    })
    .select()
    .single()
  if (aErr) throw aErr

  try {
    const r = await claude({
      system:   ALLOCATE_SYSTEM,
      messages: [{ role: 'user', content: userMessage }],
      max_tokens: 4096,
    })
    const text = r.content?.[0]?.text || ''
    const parsed = JSON.parse(text)

    await supabase.from('pa_analyses').update({
      allocation_method: parsed.allocation_method,
      trigger_theory:    parsed.trigger_theory || triggerTheory,
      methodology_text:  parsed.methodology_text,
      status:            'complete',
      raw_engine_output: parsed,
    }).eq('id', analysis.id)

    if (Array.isArray(parsed.results) && parsed.results.length) {
      await supabase.from('pa_analysis_results').insert(
        parsed.results.map((row, i) => ({
          analysis_id:         analysis.id,
          policy_id:           row.policy_id,
          carrier:             row.carrier,
          policy_number:       row.policy_number,
          policy_effective:    row.policy_effective,
          policy_expiration:   row.policy_expiration,
          policy_state_issued: row.policy_state_issued,
          share_pct:           row.share_pct,
          allocated_amount:    row.allocated_amount,
          rationale:           row.rationale,
          ordering:            i,
        }))
      )
    }

    return { ok: true, analysisId: analysis.id }
  } catch (e) {
    await supabase.from('pa_analyses').update({ status: 'failed', error: String(e) }).eq('id', analysis.id)
    throw e
  }
}

// ---------- HTTP entrypoint ---------------------------------------------------

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { mode, policyId, matterId, governingStateOverride, triggerTheoryOverride } = await req.json()

    // Use the caller's auth so RLS is enforced. Fall back to service role only
    // for operations that need to write across orgs (we don't here — yet).
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    if (mode === 'extract_terms') {
      if (!policyId) throw new Error('policyId required')
      const out = await handleExtract(supabase, policyId)
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'allocate') {
      if (!matterId) throw new Error('matterId required')
      const out = await handleAllocate(supabase, matterId, { governingStateOverride, triggerTheoryOverride })
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown mode' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
