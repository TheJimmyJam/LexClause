// supabase/functions/analyze-policy/index.ts
//
// LexClause analysis engine. Two modes:
//   1. mode = 'extract_terms' — Reads a stored policy PDF and writes structured
//      fields back to lc_policies (+ endorsements/exclusions). Uses Anthropic's
//      native PDF input (no separate OCR step).
//   2. mode = 'allocate'      — Combines policies, the matter, and the chosen
//      governing-state rule into an allocation result; writes lc_analyses +
//      lc_analysis_results with a methodology memo.
//
// Required Edge Function secrets (set via `supabase secrets set`):
//   ANTHROPIC_API_KEY
//   ANTHROPIC_MODEL          (optional, default claude-sonnet-4-6)
//   SUPABASE_URL             (auto)
//   SUPABASE_SERVICE_ROLE_KEY (auto)

// @ts-nocheck
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

// ── Prompts ─────────────────────────────────────────────────────────────────
const EXTRACT_SYSTEM = `You are a senior coverage attorney reading a single insurance policy PDF. Extract structured data and return ONE JSON object that matches this exact shape — no prose, no markdown, no code fences:

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
- Quote other-insurance and allocation language verbatim where possible — that text is the operative legal language.
- Amounts as integers in USD (no commas, no $).
- Use null when the document does not state a value. Do NOT guess.
- state_issued: 2-letter US postal code from the declarations or filings; null if absent.
- Output MUST be valid JSON. No prose, no markdown fences, just the JSON.`

const ALLOCATE_SYSTEM = `You are a coverage attorney drafting a methodology memo for a multi-policy allocation. You will be given the matter facts, the relevant policies (already extracted), and the controlling state's allocation rule. Produce ONE JSON object — no prose, no markdown:

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
      "share_pct": number,
      "allocated_amount": number,
      "rationale": string
    }
  ],
  "methodology_text": string
}

Rules:
- Sum of share_pct must equal 1.0 (within 0.001).
- Sum of allocated_amount must equal damages_exposure.
- Cite at least one controlling case from the governing state in methodology_text.
- If facts are insufficient (e.g. no damages exposure), set allocation_method = "undetermined" and explain what is missing.
- methodology_text: 1-3 paragraphs. Trigger choice, allocation rule, why this rule applies under the governing state's law, citation.`

// ── Helpers ─────────────────────────────────────────────────────────────────
async function downloadAsBase64(supabase, bucket, storagePath) {
  const { data, error } = await supabase.storage.from(bucket).download(storagePath)
  if (error) throw new Error(`Storage download failed: ${error.message}`)
  const buf = new Uint8Array(await data.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(buf.subarray(i, i + chunk)))
  }
  return btoa(binary)
}

function parseJsonFromClaude(text) {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/i, '')
    .trim()
  return JSON.parse(cleaned)
}

async function callClaude({ system, userContent, max_tokens = 4096 }) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`Anthropic ${r.status}: ${errText.slice(0, 500)}`)
  }
  return await r.json()
}

// ── Mode: extract_terms ─────────────────────────────────────────────────────
async function handleExtract(supabase, policyId) {
  const { data: policy, error: pErr } = await supabase.from('lc_policies').select('*').eq('id', policyId).single()
  if (pErr || !policy) throw new Error('Policy not found')
  if (!policy.source_storage_path) {
    await supabase.from('lc_policies').update({
      extraction_status: 'failed',
      extraction_error:  'No source_storage_path on policy.',
    }).eq('id', policyId)
    return { ok: false, reason: 'no_storage_path' }
  }

  await supabase.from('lc_policies').update({ extraction_status: 'extracting', extraction_error: null }).eq('id', policyId)

  let parsed
  try {
    const pdfB64 = await downloadAsBase64(supabase, 'lc-policies', policy.source_storage_path)
    const claudeResp = await callClaude({
      system: EXTRACT_SYSTEM,
      userContent: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
        { type: 'text', text: 'Extract the policy data from the attached PDF. Return only the JSON object - no prose.' },
      ],
      max_tokens: 4096,
    })
    const text = claudeResp.content?.[0]?.text || ''
    parsed = parseJsonFromClaude(text)
  } catch (e) {
    const msg = String(e?.message || e).slice(0, 1000)
    await supabase.from('lc_policies').update({ extraction_status: 'failed', extraction_error: msg }).eq('id', policyId)
    throw e
  }

  await supabase.from('lc_policies').update({
    carrier:                parsed.carrier ?? null,
    policy_number:          parsed.policy_number ?? null,
    named_insured:          parsed.named_insured ?? null,
    additional_insureds:    parsed.additional_insureds ?? [],
    effective_date:         parsed.effective_date ?? null,
    expiration_date:        parsed.expiration_date ?? null,
    state_issued:           parsed.state_issued ?? null,
    policy_form:            parsed.policy_form ?? null,
    per_occurrence_limit:   parsed.per_occurrence_limit ?? null,
    general_aggregate:      parsed.general_aggregate ?? null,
    products_aggregate:     parsed.products_aggregate ?? null,
    self_insured_retention: parsed.self_insured_retention ?? null,
    deductible:             parsed.deductible ?? null,
    attachment_point:       parsed.attachment_point ?? null,
    other_insurance_clause: parsed.other_insurance_clause ?? null,
    other_insurance_type:   parsed.other_insurance_type ?? null,
    allocation_method_text: parsed.allocation_method_text ?? null,
    has_anti_stacking_clause:           !!parsed.has_anti_stacking_clause,
    has_non_cumulation_clause:          !!parsed.has_non_cumulation_clause,
    has_prior_acts_exclusion:           !!parsed.has_prior_acts_exclusion,
    has_known_loss_exclusion:           !!parsed.has_known_loss_exclusion,
    has_continuous_trigger_endorsement: !!parsed.has_continuous_trigger_endorsement,
    extraction_status: 'complete',
    extraction_error:  null,
    extracted_at:      new Date().toISOString(),
    raw_extraction:    parsed,
  }).eq('id', policyId)

  await supabase.from('lc_policy_endorsements').delete().eq('policy_id', policyId)
  await supabase.from('lc_policy_exclusions').delete().eq('policy_id', policyId)
  if (Array.isArray(parsed.endorsements) && parsed.endorsements.length) {
    await supabase.from('lc_policy_endorsements').insert(parsed.endorsements.map((e) => ({
      policy_id:      policyId,
      endorsement_no: e.endorsement_no ?? null,
      label:          e.label ?? '',
      text:           e.text  ?? '',
      effect:         e.effect ?? null,
    })))
  }
  if (Array.isArray(parsed.exclusions) && parsed.exclusions.length) {
    await supabase.from('lc_policy_exclusions').insert(parsed.exclusions.map((e) => ({
      policy_id: policyId,
      label:     e.label ?? '',
      text:      e.text  ?? '',
    })))
  }

  return { ok: true, policy_id: policyId, parsed }
}

// ── Mode: allocate ──────────────────────────────────────────────────────────
async function handleAllocate(supabase, matterId, opts = {}) {
  const { data: matter } = await supabase
    .from('lc_matters')
    .select('*, lc_matter_policies(policy_id, role, lc_policies(*))')
    .eq('id', matterId)
    .single()
  if (!matter) throw new Error('Matter not found')

  const policies = (matter.lc_matter_policies || []).map((mp) => mp.lc_policies).filter(Boolean)
  const governingState = opts.governingStateOverride || matter.governing_state
  const triggerTheory  = opts.triggerTheoryOverride  || matter.trigger_theory
  if (!governingState) throw new Error('Matter has no governing_state')
  if (!policies.length) throw new Error('Matter has no policies attached')

  const { data: rule } = await supabase.from('lc_state_law_rules').select('*').eq('state_code', governingState).maybeSingle()

  const userPayload = JSON.stringify({
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

  const { data: analysis, error: aErr } = await supabase
    .from('lc_analyses')
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
    const claudeResp = await callClaude({
      system: ALLOCATE_SYSTEM,
      userContent: [{ type: 'text', text: userPayload }],
      max_tokens: 4096,
    })
    const text = claudeResp.content?.[0]?.text || ''
    const parsed = parseJsonFromClaude(text)

    await supabase.from('lc_analyses').update({
      allocation_method: parsed.allocation_method,
      trigger_theory:    parsed.trigger_theory || triggerTheory,
      methodology_text:  parsed.methodology_text,
      status:            'complete',
      raw_engine_output: parsed,
    }).eq('id', analysis.id)

    if (Array.isArray(parsed.results) && parsed.results.length) {
      // Map Claude's results back to real policy UUIDs by (carrier, policy_number).
      // We can't trust Claude to echo the UUID character-perfect — it sometimes
      // transcribes one wrong, which then fails the FK insert.
      const byKey = new Map()
      for (const p of policies) {
        byKey.set(`${(p.carrier || '').trim()}|${(p.policy_number || '').trim()}`, p.id)
        // Also key by id alone as a fallback
        byKey.set(p.id, p.id)
      }
      const resolvePolicyId = (row) => {
        if (row.policy_id && byKey.has(row.policy_id)) return row.policy_id
        const k = `${(row.carrier || '').trim()}|${(row.policy_number || '').trim()}`
        if (byKey.has(k)) return byKey.get(k)
        // Last resort: match by policy_number only
        for (const p of policies) {
          if ((p.policy_number || '').trim() === (row.policy_number || '').trim()) return p.id
        }
        return null
      }

      await supabase.from('lc_analysis_results').insert(
        parsed.results.map((row, i) => ({
          analysis_id:         analysis.id,
          policy_id:           resolvePolicyId(row),
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

    return { ok: true, analysisId: analysis.id, parsed }
  } catch (e) {
    await supabase.from('lc_analyses').update({ status: 'failed', error: String(e?.message || e).slice(0, 1000) }).eq('id', analysis.id)
    throw e
  }
}

// ── HTTP entrypoint ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { mode, policyId, matterId, governingStateOverride, triggerTheoryOverride } = await req.json()

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
