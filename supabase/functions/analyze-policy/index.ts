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

const ALLOCATE_SYSTEM = `You are a coverage attorney producing a defensible per-carrier allocation. You will receive: the matter facts, the policies (already extracted) with limits/attachment_point/SIR/other-insurance language, and the controlling state's default rule.

Treat insurance as a TOWER, not a flat pool. Apply this method, in order:

1. CLASSIFY each policy by layer:
   - "primary"  — attachment_point is null/0 AND policy_form is CGL_OCCURRENCE or CGL_CLAIMS_MADE
   - "umbrella" — policy_form = UMBRELLA (sits above primary, often follows-form, may carry its own SIR)
   - "excess"   — policy_form = EXCESS (follows form of underlying; pure excess)
   The attachment_point is the dollar amount of underlying coverage that must be exhausted before this layer responds.

2. CHOOSE THE TRIGGER:
   - Single-event / single-occurrence loss → state's actual-injury or manifestation rule
   - Long-tail loss (continuous exposure period) → state's continuous-trigger / injury-in-fact rule

3. IDENTIFY TRIGGERED POLICIES:
   - Single-event: every policy in force on the loss date
   - Long-tail: every policy whose period overlaps the injury period

4. BUILD THE TOWER(S):
   - Sort triggered policies by (policy_year, attachment_point ASC)
   - For long-tail with continuous trigger: one tower per triggered year

5. ALLOCATE THE LOSS THROUGH THE TOWER(S) — sequentially, layer by layer:
   a. Apply each policy's SIR/deductible — that money comes from the insured, not the carrier. Track this as insured_retention.
   b. PRIMARY LAYER: co-primary insurers share the primary layer per the controlling rule:
      - state default (pro-rata-by-time, pro-rata-by-limits, equal shares, targeted tender, all-sums)
      - modified by other-insurance clauses (PRIMARY / EXCESS / PRO_RATA / ESCAPE / EXCESS_OVER_OTHER)
      - "Primary and Non-Contributory" only fires when triggered by a written contract on an additional insured; if no such contract is established in the facts, treat the policy as a normal co-primary
      - "Mutually repugnant" excess-vs-excess clauses → fall back to state default (often pro-rata or equal shares)
   c. After primary is exhausted, UMBRELLA attaches at its attachment_point up to its own limit.
   d. After umbrella, each EXCESS layer attaches sequentially.
   e. Stop once damages_exposure is fully allocated.

6. LONG-TAIL with multi-year triggers:
   - States like NJ (Owens-Illinois), NY (Consol Edison), MA (Boston Gas), PA, FL: pro-rata-by-time-on-risk first, allocating exposure across triggered years; then within each year apply step 5
   - States like CA (Montrose II), OH (Goodyear), WA (B&L Trucking): all-sums — insured may pick any one triggered policy and demand full payment up to limits, with rights of contribution; do NOT split across years unless asked
   - IL targeted-tender: only the targeted carriers contribute; equal shares among them
   - Vertical vs. horizontal exhaustion turns on the state — note it explicitly when relevant

7. SUM CHECK (the most important step):
   - Sum of all results[].allocated_amount + insured_retention MUST equal matter.damages_exposure (within $1)
   - Each results[].allocated_amount MUST be ≤ that policy's applicable_limit at its layer
   - If you can't satisfy these constraints, set allocation_method = "undetermined" and explain what's missing

OUTPUT — ONE JSON object, no prose, no markdown:

{
  "allocation_method": "pro_rata_time_on_risk"|"pro_rata_by_limits"|"all_sums"|"all_sums_with_reallocation"|"equal_shares"|"targeted_tender"|"undetermined",
  "trigger_theory": "exposure"|"manifestation"|"continuous_trigger"|"injury_in_fact"|"actual_injury"|"undetermined",
  "tower_explanation": string,           // 2-4 sentences describing the layer structure (e.g. "Two co-primary CGL policies at $1M each share the first $1M; Liberty Mutual umbrella attaches at $1M with $25k SIR and a $5M limit covering the next $475k; insured pays $25k SIR.")
  "insured_retention": number,           // total $ the insured pays out-of-pocket (sum of SIRs/deductibles that hit before insurance pays at the relevant layer; 0 if all coverage is first-dollar)
  "results": [
    {
      "policy_id": string,               // echo back the UUID from input — use exact string match; if unsure, leave as the policy_number
      "carrier": string,
      "policy_number": string,
      "policy_effective": "YYYY-MM-DD",
      "policy_expiration": "YYYY-MM-DD",
      "policy_state_issued": string,
      "layer": "primary"|"umbrella"|"excess"|"self_insured",
      "attachment_point": number,        // 0 for primary
      "applicable_limit": number,        // per-occurrence or aggregate cap as it applies to this loss
      "share_pct": number,               // this carrier's share of the TOTAL loss as a decimal 0..1 (sum of all results[].share_pct + insured_retention/damages_exposure must equal 1.0)
      "allocated_amount": number,        // dollars this carrier owes
      "rationale": string                // 1-3 sentences — why this carrier owes this much at this layer
    }
  ],
  "methodology_text": string             // 2-4 paragraph memo. Trigger choice. Layer structure. Why the controlling state's rule applies. Cite at least one controlling case from the governing state. Note any meaningful endorsement effects (Primary-Non-Contributory, anti-stacking, follows-form, etc.).
}

CITATION RULES — strict:
- The state_rule object provided in the user payload contains a "citations" array of vetted, verified case citations for the controlling state. **Use those citations and only those citations** when supporting the rule of decision in methodology_text.
- Do NOT invent or paraphrase case names, reporter cites, court names, or years from your training data. Coverage law is the kind of legal area where misciting is malpractice.
- If you need a proposition that is not supported by a citation in state_rule.citations, write it as a general statement of doctrine without a fake citation, OR say "no citation in catalog for this point" rather than invent one.
- If state_rule.citations is empty or missing, write the methodology in general terms and explicitly note that the catalog has no curated citations for this jurisdiction yet.

INVARIANTS (verify before returning):
- sum(results[].allocated_amount) + insured_retention === matter.damages_exposure (within $1)
- each results[].allocated_amount <= results[].applicable_limit
- at least one citation from state_rule.citations in methodology_text (when the catalog has any)
- never fabricate a case — quote citations exactly as they appear in state_rule.citations`

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
  return await callClaudeMessages(system, [{ role: 'user', content: userContent }], max_tokens)
}

async function callClaudeMessages(system, messages, max_tokens = 4096) {
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens, system, messages }),
  })
  if (!r.ok) {
    const errText = await r.text()
    throw new Error(`Anthropic ${r.status}: ${errText.slice(0, 500)}`)
  }
  return await r.json()
}

// ── Allocation validator ────────────────────────────────────────────────────
// Checks Claude's output against arithmetic invariants. Returns an array of
// human-readable error objects; empty array means valid.
function validateAllocation(parsed, matter, policies) {
  const errors = []
  const exposure = Number(matter.damages_exposure || 0)
  const insuredRetention = Number(parsed.insured_retention || 0)
  const results = Array.isArray(parsed.results) ? parsed.results : []

  // 1. Sum check
  const totalAllocated = results.reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
  const grandTotal = totalAllocated + insuredRetention
  if (exposure > 0) {
    const gap = Math.round(grandTotal - exposure)
    if (Math.abs(gap) > 1) {
      errors.push({
        type: 'sum_mismatch',
        message: `Sum of all allocated_amount ($${totalAllocated.toLocaleString()}) plus insured_retention ($${insuredRetention.toLocaleString()}) equals $${grandTotal.toLocaleString()}, but matter.damages_exposure is $${exposure.toLocaleString()}. The allocation is off by $${Math.abs(gap).toLocaleString()} (${gap > 0 ? 'over' : 'under'}). Adjust the per-carrier amounts (and/or insured_retention) so the totals reconcile exactly.`,
      })
    }
  }

  // 2. Per-row limit check (cross-checked against the actual policy data)
  const policiesByKey = new Map()
  const policiesById = new Map()
  for (const p of policies) {
    policiesByKey.set(`${(p.carrier || '').trim()}|${(p.policy_number || '').trim()}`, p)
    policiesById.set(p.id, p)
  }

  for (const row of results) {
    const allocated = Number(row.allocated_amount || 0)
    const claimedLimit = Number(row.applicable_limit || 0)
    const layer = row.layer

    // Match to a real policy if possible
    let realPolicy =
      (row.policy_id && policiesById.get(row.policy_id)) ||
      policiesByKey.get(`${(row.carrier || '').trim()}|${(row.policy_number || '').trim()}`) ||
      null
    const realLimit = realPolicy ? Number(realPolicy.per_occurrence_limit || 0) : 0

    // a) self-asserted applicable_limit
    if (claimedLimit > 0 && allocated > claimedLimit + 1) {
      errors.push({
        type: 'limit_exceeded',
        carrier: row.carrier,
        policy_number: row.policy_number,
        message: `${row.carrier} (${row.policy_number}, ${layer || 'unknown layer'}): allocated_amount $${allocated.toLocaleString()} exceeds the applicable_limit you stated ($${claimedLimit.toLocaleString()}). Cap this row at the applicable_limit and reallocate the overflow to the next layer above (umbrella/excess) or to insured_retention.`,
      })
    }
    // b) cross-check vs. extracted policy data
    if (realLimit > 0 && allocated > realLimit + 1) {
      errors.push({
        type: 'real_limit_exceeded',
        carrier: row.carrier,
        policy_number: row.policy_number,
        message: `${row.carrier} (${row.policy_number}): allocated_amount $${allocated.toLocaleString()} exceeds the per-occurrence limit on the extracted policy ($${realLimit.toLocaleString()}). The carrier cannot owe more than its policy limit.`,
      })
    }
  }

  // 3. share_pct sanity (sum should be ~1.0 once SIR fraction included)
  if (exposure > 0 && results.length > 0) {
    const shareTotal = results.reduce((s, r) => s + Number(r.share_pct || 0), 0)
    const sirShare = insuredRetention / exposure
    const grandShare = shareTotal + sirShare
    if (Math.abs(grandShare - 1) > 0.01) {
      errors.push({
        type: 'share_pct_mismatch',
        message: `Sum of results[].share_pct (${shareTotal.toFixed(4)}) plus insured_retention/damages_exposure (${sirShare.toFixed(4)}) equals ${grandShare.toFixed(4)}, but should equal 1.0000. Recompute the share_pct values so they reflect each row's allocated_amount divided by damages_exposure.`,
      })
    }
  }

  return errors
}

// Build a corrective follow-up prompt given the failures of a previous attempt.
function buildRetryMessage(errors, exposure) {
  const lines = errors.map((e, i) => `  ${i + 1}. ${e.message}`).join('\n')
  return `Your previous answer failed the post-validation checks. Specifically:\n\n${lines}\n\nRules of correction:\n- Total of allocated_amount + insured_retention MUST equal $${exposure.toLocaleString()} exactly.\n- No allocated_amount may exceed its policy's per-occurrence limit.\n- Sum of share_pct + insured_retention/damages_exposure MUST equal 1.0000 (within 0.01).\n- Keep the same allocation_method and trigger_theory unless you now believe a different rule applies.\n- Return the FULL corrected JSON object — same shape as before. No prose, no markdown.`
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
    // ── Validate-and-retry loop ──────────────────────────────────────────────
    // Claude returns an answer; we run validateAllocation; if any invariants
    // fail, we feed the violations back and ask for a corrected JSON. After
    // MAX_ATTEMPTS, save what we have with validation_status='needs_review'.
    const MAX_ATTEMPTS = 3
    const conversation = [{ role: 'user', content: [{ type: 'text', text: userPayload }] }]
    let parsed = null
    let validationErrors = []
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      const claudeResp = await callClaudeMessages(ALLOCATE_SYSTEM, conversation, 4096)
      const text = claudeResp.content?.[0]?.text || ''
      try {
        parsed = parseJsonFromClaude(text)
      } catch (e) {
        // Parse failure is itself a validation error — ask Claude to fix
        validationErrors = [{ type: 'parse_error', message: `Your previous response was not valid JSON: ${String(e).slice(0, 200)}` }]
        conversation.push({ role: 'assistant', content: text })
        conversation.push({ role: 'user', content: buildRetryMessage(validationErrors, Number(matter.damages_exposure || 0)) })
        continue
      }
      validationErrors = validateAllocation(parsed, matter, policies)
      if (validationErrors.length === 0) break

      // Failed — append the bad response + corrective prompt and try again
      conversation.push({ role: 'assistant', content: text })
      conversation.push({ role: 'user', content: buildRetryMessage(validationErrors, Number(matter.damages_exposure || 0)) })
    }

    const validationStatus = validationErrors.length === 0 ? 'valid' : 'needs_review'

    await supabase.from('lc_analyses').update({
      allocation_method:    parsed?.allocation_method ?? null,
      trigger_theory:       parsed?.trigger_theory || triggerTheory,
      methodology_text:     parsed?.methodology_text ?? null,
      tower_explanation:    parsed?.tower_explanation ?? null,
      insured_retention:    typeof parsed?.insured_retention === 'number' ? parsed.insured_retention : null,
      status:               'complete',
      raw_engine_output:    parsed,
      validation_status:    validationStatus,
      validation_errors:    validationErrors.length > 0 ? validationErrors : null,
      validation_attempts:  attempt,
    }).eq('id', analysis.id)

    if (parsed && Array.isArray(parsed.results) && parsed.results.length) {
      // Map Claude's results back to real policy UUIDs by (carrier, policy_number).
      const byKey = new Map()
      for (const p of policies) {
        byKey.set(`${(p.carrier || '').trim()}|${(p.policy_number || '').trim()}`, p.id)
        byKey.set(p.id, p.id)
      }
      const resolvePolicyId = (row) => {
        if (row.policy_id && byKey.has(row.policy_id)) return row.policy_id
        const k = `${(row.carrier || '').trim()}|${(row.policy_number || '').trim()}`
        if (byKey.has(k)) return byKey.get(k)
        for (const p of policies) {
          if ((p.policy_number || '').trim() === (row.policy_number || '').trim()) return p.id
        }
        return null
      }

      // Replace any existing rows (from a previous failed attempt) with the latest
      await supabase.from('lc_analysis_results').delete().eq('analysis_id', analysis.id)
      await supabase.from('lc_analysis_results').insert(
        parsed.results.map((row, i) => ({
          analysis_id:         analysis.id,
          policy_id:           resolvePolicyId(row),
          carrier:             row.carrier,
          policy_number:       row.policy_number,
          policy_effective:    row.policy_effective,
          policy_expiration:   row.policy_expiration,
          policy_state_issued: row.policy_state_issued,
          layer:               row.layer ?? null,
          attachment_point:    typeof row.attachment_point === 'number' ? row.attachment_point : null,
          applicable_limit:    typeof row.applicable_limit === 'number' ? row.applicable_limit : null,
          share_pct:           row.share_pct,
          allocated_amount:    row.allocated_amount,
          rationale:           row.rationale,
          ordering:            i,
        }))
      )
    }

    return {
      ok: true,
      analysisId: analysis.id,
      validation_status: validationStatus,
      validation_attempts: attempt,
      validation_errors: validationErrors,
    }
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
