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

5b. TARGETED-TENDER OVERRIDE — read this BEFORE step 6:
   If matter.targeted_carriers is a non-empty array, the insured has exercised selective tender. Under IL (John Burns; Kajima) and other targeted-tender jurisdictions, this is a HARD CONSTRAINT:
   - Only carriers in matter.targeted_carriers contribute. Their share among themselves is equal (or per the controlling rule).
   - Every carrier NOT in matter.targeted_carriers has allocated_amount = 0 and share_pct = 0. They get a row in results[] with rationale = "Not tendered to under [State]'s targeted-tender rule (insured did not include this carrier in the tender)."
   - Set allocation_method = "targeted_tender" regardless of the state default if a target is specified and the state allows it.
   - If the controlling state does NOT allow targeted tender (e.g. NY, NJ, CA), note that the targeting has no legal effect and apply the state default — but flag this in methodology_text as a likely insured strategy error.

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

const MATTER_INTAKE_SYSTEM = `You are reading an insurance intake document — typically a First Notice of Loss (FNOL), reservation-of-rights letter, coverage acknowledgment, claim summary, or pleadings. Your job is to pull every fact LexClause needs to seed a coverage matter so a coverage attorney doesn't have to re-key it.

Return ONE JSON object with this exact shape — no prose, no markdown, no fences:

{
  "document_type": "FNOL"|"reservation_of_rights"|"coverage_acknowledgment"|"complaint"|"claim_summary"|"demand_letter"|"other",
  "matter_name": string|null,                       // a clean, useful matter title (e.g. "Acme Industrial v. NorthStar Builders — TX warehouse fire")
  "named_insured": string|null,                     // the insured named in the document
  "additional_insureds": string[],                  // any additional insureds called out
  "claim_number": string|null,                      // carrier claim number if shown
  "loss_type": "environmental"|"construction_defect"|"product_liability"|"asbestos"|"professional"|"cyber"|"auto"|"general_liability"|"property"|"d&o"|"other"|null,
  "loss_start_date": "YYYY-MM-DD"|null,             // when injury/damage began
  "loss_end_date": "YYYY-MM-DD"|null,               // when it ended (or same as start for single-event)
  "damages_exposure": number|null,                  // total alleged or estimated damages in USD; integer
  "venue_state": "XX"|null,                         // 2-letter postal code where suit is filed / claim is being adjusted
  "insured_hq_state": "XX"|null,                    // insured's principal place of business state
  "loss_location_states": string[],                 // states where the harm occurred
  "carriers_mentioned": [
    {
      "carrier": string,
      "policy_number": string|null,
      "role": "primary"|"umbrella"|"excess"|"unspecified"|null
    }
  ],
  "description": string                             // 2-4 sentence summary of the matter facts as stated in the document. No speculation beyond what's written.
}

Rules:
- Use ONLY information stated or directly inferable from the document. If a field is not in the document, return null (or [] for arrays). Do NOT guess.
- For matter_name, prefer the format "{Insured} — {short description of loss/venue}". Keep it under 80 characters.
- For dates, prefer the most specific. If only "2018" is stated, use "2018-01-01" and note the imprecision in description.
- For damages_exposure, pull a single number representing the alleged or estimated total. If a range is given (e.g. "$500k–$2M"), use the midpoint and note in description.
- carriers_mentioned: list every carrier the document names, with their policy number if shown.
- description: factual summary only. No legal conclusions.
- Output MUST be valid JSON — nothing else.`

// ────────────────────────────────────────────────────────────────────────────
// ONE-SHOT INTAKE PROMPTS
// ────────────────────────────────────────────────────────────────────────────
// Used by the single-input UX (Analyzer.jsx). The user drops every document
// into one bucket and we classify each one to route it to the correct
// extractor. The complaint / demand / ROR drives the allegation extraction
// that feeds the COVERAGE_PRIORITY engine.
const CLASSIFY_DOCUMENT_SYSTEM = `You are reading an uploaded PDF and classifying what kind of document it is so the system can route it to the right extractor. Return ONE JSON object — no prose, no markdown, no fences:

{
  "kind": "policy" | "complaint" | "petition" | "demand_letter" | "ror_letter" | "claim_summary" | "fnol" | "other",
  "policy_form": "CGL_OCCURRENCE" | "CGL_CLAIMS_MADE" | "UMBRELLA" | "EXCESS" | "PROFESSIONAL" | "POLLUTION_CONTRACTOR" | "POLLUTION_SITE" | "BUILDERS_RISK" | "D&O" | "PROPERTY" | "OTHER" | null,
  "carrier_or_caption": string | null,
  "venue_state": "XX" | null,
  "governing_state_hint": "XX" | null,
  "confidence": "high" | "medium" | "low",
  "summary": string
}

Rules:
- kind = "policy" for any insurance policy. Set policy_form to the closest match. A contractor's pollution liability policy is policy_form="POLLUTION_CONTRACTOR"; a site-specific pollution policy is "POLLUTION_SITE"; a builder's risk policy is "BUILDERS_RISK"; a professional/E&O policy is "PROFESSIONAL".
- kind = "complaint" or "petition" for a filed pleading (look for caption, court, civil action number).
- kind = "demand_letter" for a pre-suit demand from a plaintiff or counsel.
- kind = "ror_letter" for a reservation of rights letter from a carrier.
- kind = "fnol" for a first notice of loss form.
- kind = "claim_summary" for a carrier's internal claim summary or coverage memo.
- kind = "other" only if you genuinely cannot tell.
- carrier_or_caption: for a policy, the carrier's name (e.g. "Travelers"); for a lawsuit, the case caption (e.g. "Doe v. Greenfield Builders").
- venue_state: for a lawsuit, the 2-letter state code where the case is filed; for a policy, the state on the declarations page.
- governing_state_hint: usually the same as venue_state for policies; for lawsuits, where the case is filed.
- summary: one factual sentence describing what this document is. No legal conclusions.
- Use null where unclear. Do NOT guess.
- Output MUST be valid JSON.`

const EXTRACT_ALLEGATIONS_SYSTEM = `You are reading a legal document — a complaint, petition, pre-suit demand letter, reservation-of-rights letter, or claim summary — and extracting the structured allegations that drive coverage priority analysis. Return ONE JSON object — no prose, no markdown, no fences:

{
  "matter_name": string,
  "named_defendants": [string],
  "named_plaintiffs": [string],
  "venue_state": "XX" | null,
  "loss_start_date": "YYYY-MM-DD" | null,
  "loss_end_date": "YYYY-MM-DD" | null,
  "loss_type": "environmental" | "construction_defect" | "product_liability" | "asbestos" | "professional" | "cyber" | "auto" | "general_liability" | "property" | "d&o" | "other" | null,
  "allegations": [
    {
      "count": number | null,
      "theory_of_liability": string,
      "conduct_alleged": string,
      "harm_type": "bodily_injury" | "property_damage" | "property_damage_pollution" | "bodily_injury_long_tail" | "professional_negligence" | "economic_loss" | "punitive" | "other"
    }
  ],
  "description": string
}

Rules:
- matter_name: a clean title like "Doe v. Greenfield Builders — TX construction site spill". Under 80 chars.
- One allegation per logical count. If a count alleges multiple harms (e.g. "negligence resulting in bodily injury AND property damage"), split it.
- harm_type drives which policies respond:
  - "bodily_injury" → CGL bodily-injury
  - "property_damage" → CGL property-damage
  - "property_damage_pollution" → property damage tied to a pollutant release; pollution policies are typically primary, CGL pollution exclusions usually bar
  - "bodily_injury_long_tail" → continuous-trigger states (asbestos, environmental exposure)
  - "professional_negligence" → professional liability / E&O; usually barred from CGL
  - "economic_loss" → typically not covered by CGL
  - "punitive" → derivative; coverage depends on state and underlying conduct
- venue_state: pull from the court caption (the state portion).
- Dates: pull from the conduct alleged, NOT the filing date. If only "summer 2018" is stated, use "2018-06-01" and note in description.
- Use null where not stated.
- description: 2-3 sentence factual summary of the case. No legal conclusions beyond what the document itself states.
- Output MUST be valid JSON.`

// ────────────────────────────────────────────────────────────────────────────
// COVERAGE PRIORITY ENGINE
// ────────────────────────────────────────────────────────────────────────────
// Replaces the old ALLOCATE_SYSTEM prompt for new analyses (mode='coverage_priority').
// Produces a three-section legal opinion (Trigger / Priority / Exhaustion) plus a
// 2-3 paragraph narrative. Does NOT allocate dollars — answers the threshold
// legal question of which policies are triggered and in what priority order they
// respond, under the controlling state's law.
//
// Ground truth comes from lc_state_law_rules with separated narratives + citation
// arrays per dimension (trigger / priority / exhaustion). Citation discipline is
// strict: the engine is forbidden from inventing case names and is pinned to the
// catalog. Validation is structural (every policy gets a trigger entry, priority
// only includes triggered policies, citations come from the catalog).
const COVERAGE_PRIORITY_SYSTEM = `You are a senior coverage attorney producing a defensible coverage-priority opinion for a single matter. Your output drives a downstream legal work product, so it must be precise, conservative, and citable. Do not invent law. Do not overstate certainty. If a piece of authority is not in the supplied catalog, say so plainly rather than fabricate it.

You will receive ONE JSON payload with three top-level objects:

- matter — the underlying claim. Includes:
  - name, description, loss_type
  - loss_start_date, loss_end_date
  - venue_state, governing_state
  - allegations — array of {count, theory_of_liability, conduct_alleged, harm_type} extracted from the underlying complaint, petition, pre-suit demand, ROR, or claim summary
- policies — array of N policies, each already extracted with: id, carrier, policy_number, effective_date, expiration_date, state_issued, policy_form (CGL_OCCURRENCE | CGL_CLAIMS_MADE | UMBRELLA | EXCESS | PROFESSIONAL | POLLUTION_CONTRACTOR | POLLUTION_SITE | BUILDERS_RISK | D&O | OTHER), per_occurrence_limit, general_aggregate, self_insured_retention, attachment_point, other_insurance_clause (verbatim, may be null if silent), other_insurance_type (PRIMARY | EXCESS | PRO_RATA | ESCAPE | EXCESS_OVER_OTHER | SILENT), endorsements (with effect: BROADENS | RESTRICTS | NEUTRAL), exclusions, and key flags (has_anti_stacking_clause, has_non_cumulation_clause, has_continuous_trigger_endorsement, etc.)
- state_rule — the controlling state's rules with vetted citations:
  - state_code, name
  - trigger_test (e.g. "eight-corners rule", "four-corners rule", "potentiality of coverage with extrinsic evidence")
  - trigger_citations — array of strings; ONLY use these for trigger authority
  - priority_rule (e.g. "gives effect to plain policy language; competing excess clauses prorate by limits when mutually repugnant")
  - priority_citations — array of strings; ONLY use these for priority authority
  - exhaustion_rule_text ("vertical" | "horizontal" | "mixed" | "undetermined")
  - exhaustion_citations — array of strings; ONLY use these for exhaustion authority

ANALYZE in this order.

STEP 1 — TRIGGER (duty-to-defend layer).
For EACH policy in policies, apply the state's trigger_test to the matter's allegations. Decide:
- triggered: "yes" if EVERY implicating allegation potentially falls within the policy's coverage grant and is not barred by an applicable exclusion (or if there is only one allegation and it is covered).
- triggered: "no" if NO allegation survives the coverage analysis. This includes BOTH situations where (a) no allegation falls within the coverage grant, AND (b) every allegation that does is then barred by an applicable exclusion. If you conclude a clear exclusion bars every implicating allegation, the answer is "no" — do NOT mark it "partial" because the coverage grant was nominally implicated. The exclusion analysis is part of the trigger answer.
- triggered: "partial" ONLY if there is a genuine mixed-claim situation — at least one allegation is covered AND at least one allegation is not covered (whether because it falls outside the grant or because a different exclusion bars it). Do not use "partial" as a hedge.

Quote or near-quote the specific allegations driving the answer. Quote the specific coverage grant or exclusion that drives the answer. Be concrete.

A claims-made policy is only triggered if the claim was first made during the policy period (or extended reporting period). An occurrence-based policy is triggered if the bodily injury or property damage occurred during the policy period.

STEP 2 — PRIORITY (Other Insurance / primary-vs-excess layer).
Among policies where triggered != "no", rank in order of responsibility:
- "primary" — first responder; its limits exhaust first.
- "co-primary" — multiple policies share the primary layer.
- "excess" — attaches above primary.
- "sub-excess" — attaches above excess.

To rank:
a. Pull each triggered policy's other_insurance_clause (verbatim) and other_insurance_type.
b. Apply these general principles, layered with state_rule.priority_rule:
   - SILENT or PRIMARY → defaults to primary.
   - EXCESS or EXCESS_OVER_OTHER on one + SILENT/PRIMARY on another → SILENT/PRIMARY is primary; EXCESS is excess.
   - EXCESS on TWO OR MORE → potentially mutually repugnant; apply state's tiebreaker (often pro-rata by limits, equal shares, specific-over-general, or closest-to-the-risk).
   - PRO_RATA + EXCESS → most states give effect to the EXCESS clause; PRO_RATA is primary.
   - ESCAPE clauses are disfavored; treat with caution.
c. Consider policy_form: a CGL is generally primary to UMBRELLA/EXCESS forms regardless of Other Insurance clauses, because umbrella/excess attach at attachment_point. Pollution-specific policies (POLLUTION_CONTRACTOR, POLLUTION_SITE) often serve as primary for pollution losses where a CGL pollution exclusion bars the CGL.
d. Consider endorsements: "Primary and Non-Contributory" requires a written contract on an additional insured to fire.
e. State the controlling priority rule with a citation drawn ONLY from state_rule.priority_citations.

Group mutually-repugnant policies with the default rule that kicks in.

STEP 3 — EXHAUSTION.
State the controlling exhaustion rule with a citation drawn ONLY from state_rule.exhaustion_citations. Explain how it interacts with this specific tower.
- vertical: an excess attaches once the directly-underlying primary is exhausted, regardless of other co-primaries.
- horizontal: ALL primaries across all triggered years must exhaust before any excess attaches.
- mixed: turns on policy language or specific facts.

STEP 4 — NARRATIVE.
2-3 paragraphs of opinion-style prose. Walk through allegations -> triggered policies -> priority order -> exhaustion rule. Use the same citations you used in the structured fields. Do not introduce new authority.

OUTPUT — ONE JSON OBJECT, no prose, no markdown:

{
  "trigger_analysis": [
    {
      "policy_id": string,
      "carrier": string,
      "policy_number": string,
      "policy_form": string,
      "triggered": "yes" | "no" | "partial",
      "allegations_implicating_coverage": [string],
      "coverage_grant_basis": string,
      "exclusions_considered": [
        { "label": string, "applies": boolean, "rationale": string }
      ],
      "rationale": string
    }
  ],
  "priority_analysis": {
    "ordered_policies": [
      {
        "policy_id": string,
        "carrier": string,
        "policy_number": string,
        "rank": "primary" | "co-primary" | "excess" | "sub-excess",
        "rank_basis": string,
        "other_insurance_quote": string,
        "other_insurance_type": string
      }
    ],
    "mutually_repugnant_groups": [
      {
        "policy_ids": [string],
        "reason": string,
        "default_rule": string
      }
    ],
    "rule_applied": string,
    "rule_citation": string
  },
  "exhaustion_analysis": {
    "rule": "vertical" | "horizontal" | "mixed" | "undetermined",
    "rationale": string,
    "rule_citation": string
  },
  "narrative": string
}

CITATION RULES — STRICT.
- The state_rule object contains three citation arrays: trigger_citations, priority_citations, exhaustion_citations.
- Use ONLY citations from those arrays, and use them in the SECTION they belong to. Do not cross-cite.
- Do NOT invent case names, reporter cites, court names, or years from training data. Coverage law is the kind of legal area where misciting is malpractice.
- If a section's citation array is empty or missing, write the doctrine in general terms and explicitly say "no citation in catalog for this point."

INVARIANTS (verify before returning).
- Every policy in input.policies has exactly one entry in trigger_analysis.
- priority_analysis.ordered_policies contains only policies with triggered != "no".
- Every cited authority in priority_analysis.rule_citation appears in state_rule.priority_citations.
- Every cited authority in exhaustion_analysis.rule_citation appears in state_rule.exhaustion_citations.
- Output is valid JSON. No prose, no markdown fences.`

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

async function callClaude({ system, userContent, max_tokens = 4096, timeoutMs = undefined, maxAttempts = undefined }) {
  return await callClaudeMessages(
    system,
    [{ role: 'user', content: userContent }],
    max_tokens,
    { timeoutMs, maxAttempts },
  )
}

async function callClaudeMessages(system, messages, max_tokens = 4096, opts: { timeoutMs?: number, maxAttempts?: number } = {}) {
  // Retry with exponential backoff for transient errors (429 rate-limit, 5XX
  // overloaded/timeout). Real 4XX errors (auth, bad request) bubble up
  // immediately. Up to 3 attempts total: 0s, 1s, 3s.
  // Per-attempt timeout defaults to 55s — this keeps the total worst-case
  // call time well under Supabase's background-task budget so the engine
  // can complete (or fail cleanly) before the instance is reaped.
  // Callers can override timeoutMs / maxAttempts for slower modes.
  const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504, 529])
  const MAX_ATTEMPTS = opts.maxAttempts ?? 3
  const PER_ATTEMPT_TIMEOUT_MS = opts.timeoutMs ?? 55_000
  let lastErr = null

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delayMs = (Math.pow(2, attempt) - 1) * 1000  // 1s, 3s, 7s
      await new Promise(res => setTimeout(res, delayMs))
    }
    const ctrl   = new AbortController()
    const timer  = setTimeout(() => ctrl.abort(), PER_ATTEMPT_TIMEOUT_MS)
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        signal: ctrl.signal,
        headers: {
          'Content-Type':      'application/json',
          'x-api-key':         ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens, system, messages }),
      })
      // Do NOT clearTimeout here — keep the abort active while reading the
      // response body. Claude can be slow to stream the full JSON even after
      // headers arrive, and we must honour the per-attempt budget end-to-end.
      if (r.ok) {
        const json = await r.json()   // abort signal still in effect
        clearTimeout(timer)
        return json
      }

      const errText = await r.text()
      clearTimeout(timer)
      const errMsg  = `Anthropic ${r.status}: ${errText.slice(0, 500)}`
      if (RETRYABLE_STATUSES.has(r.status) && attempt < MAX_ATTEMPTS - 1) {
        lastErr = new Error(errMsg)
        continue  // retry
      }
      throw new Error(errMsg)  // non-retryable, or final attempt
    } catch (e) {
      clearTimeout(timer)
      // AbortError (our own timeout) and other network errors are retryable.
      const msg       = String(e?.message || e)
      const isAbort   = e?.name === 'AbortError'
      const isNetwork = !msg.startsWith('Anthropic ')  // our own throws start with "Anthropic"
      if ((isAbort || isNetwork) && attempt < MAX_ATTEMPTS - 1) {
        lastErr = isAbort ? new Error(`Anthropic request timed out after ${PER_ATTEMPT_TIMEOUT_MS/1000}s`) : e
        continue
      }
      if (isAbort) throw new Error(`Anthropic request timed out after ${PER_ATTEMPT_TIMEOUT_MS/1000}s`)
      throw e
    }
  }
  throw lastErr || new Error('Anthropic call failed after retries')
}

// ── Allocation validator ────────────────────────────────────────────────────
// Checks Claude's output against arithmetic invariants. Returns an array of
// human-readable error objects; empty array means valid.
function validateAllocation(parsed, matter, policies) {
  const errors = []
  const exposure = Number(matter.damages_exposure || 0)
  const insuredRetention = Number(parsed.insured_retention || 0)
  const results = Array.isArray(parsed.results) ? parsed.results : []
  const targetedIds = new Set(Array.isArray(matter.targeted_carriers) ? matter.targeted_carriers : [])

  // 0. Targeted-tender enforcement (deterministic — not LLM judgment)
  if (targetedIds.size > 0) {
    const policiesByKey = new Map(
      policies.map(p => [`${(p.carrier || '').trim()}|${(p.policy_number || '').trim()}`, p])
    )
    for (const row of results) {
      const realPolicy =
        (row.policy_id && policies.find(p => p.id === row.policy_id)) ||
        policiesByKey.get(`${(row.carrier || '').trim()}|${(row.policy_number || '').trim()}`) ||
        null
      const isTargeted = realPolicy ? targetedIds.has(realPolicy.id) : false
      const allocated  = Number(row.allocated_amount || 0)
      if (!isTargeted && allocated > 1) {
        errors.push({
          type: 'targeted_tender_violation',
          carrier: row.carrier,
          policy_number: row.policy_number,
          message: `${row.carrier} (${row.policy_number}) was NOT tendered to. Under the targeted-tender rule of the controlling state, allocated_amount must be $0 (got $${allocated.toLocaleString()}). Reallocate this share to the targeted carriers, or to insured_retention if no targeted carrier has remaining capacity.`,
        })
      }
    }
  }

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

// ── Coverage-priority validator ─────────────────────────────────────────────
// Structural validation for coverage_priority mode output. Checks that every
// policy has a trigger entry, that priority ranking only includes triggered
// policies, and that cited authorities trace back to the supplied catalog.
// Returns an array of error objects; empty array means valid.
function validateCoveragePriority(parsed, _matter, policies, stateRule) {
  const errors = []

  // 1. Top-level structure
  for (const k of ['trigger_analysis', 'priority_analysis', 'exhaustion_analysis', 'narrative']) {
    if (!(k in parsed)) {
      errors.push({ type: 'missing_top_level', message: `Output is missing required top-level key "${k}". Add it.` })
    }
  }

  const trigList = Array.isArray(parsed.trigger_analysis) ? parsed.trigger_analysis : []
  const priority = parsed.priority_analysis || {}
  const ordered  = Array.isArray(priority.ordered_policies) ? priority.ordered_policies : []

  // 2. Every input policy has exactly one trigger entry
  const polIds   = new Set(policies.map((p) => p.id))
  const trigIds  = new Set(trigList.map((t) => t && t.policy_id).filter(Boolean))
  const missing  = [...polIds].filter((id) => !trigIds.has(id))
  if (missing.length > 0) {
    errors.push({
      type: 'trigger_missing_policies',
      message: `trigger_analysis is missing entries for policies: ${missing.join(', ')}. Add one entry per input policy.`,
    })
  }
  // Reject duplicate trigger entries for the same policy
  const seen = new Map()
  for (const t of trigList) {
    if (!t || !t.policy_id) continue
    seen.set(t.policy_id, (seen.get(t.policy_id) || 0) + 1)
  }
  for (const [pid, n] of seen) {
    if (n > 1) {
      errors.push({
        type: 'trigger_duplicate_policy',
        message: `policy_id ${pid} appears ${n} times in trigger_analysis — should appear exactly once.`,
      })
    }
  }

  // 3. priority_analysis.ordered_policies contains only triggered != "no" policies
  const triggeredYesOrPartial = new Set(
    trigList.filter((t) => t.triggered === 'yes' || t.triggered === 'partial').map((t) => t.policy_id)
  )
  for (const row of ordered) {
    if (!triggeredYesOrPartial.has(row.policy_id)) {
      errors.push({
        type: 'priority_includes_untriggered',
        message: `Policy ${row.policy_id} (${row.carrier}, ${row.policy_number}) is in priority_analysis.ordered_policies but its trigger_analysis entry is "no". Drop it from the priority stack.`,
      })
    }
  }
  // Every triggered policy SHOULD appear in priority unless explicitly excluded by mutually_repugnant grouping logic.
  // (We don't strictly require this — some priority outputs may legitimately omit a policy if the model concluded
  //  it had no priority role to play. But flag it as advisory rather than fatal.)

  // 4. Citation discipline — case-name match against catalog
  const trigCatalog = new Set(asArray(stateRule?.trigger_citations))
  const prioCatalog = new Set(asArray(stateRule?.priority_citations))
  const exhaCatalog = new Set(asArray(stateRule?.exhaustion_citations))

  const citePassesCatalog = (cite, catalog) => {
    if (!cite) return true
    if (catalog.size === 0) return true // empty catalog → engine instructed to skip citing
    const cl = cite.toLowerCase()
    for (const c of catalog) {
      const caseName = String(c).split(',')[0].toLowerCase().trim()
      if (caseName && cl.includes(caseName)) return true
    }
    return false
  }

  if (!citePassesCatalog(priority.rule_citation, prioCatalog)) {
    errors.push({
      type: 'priority_citation_not_in_catalog',
      message: `priority_analysis.rule_citation (${priority.rule_citation || ''}) does not match any case in state_rule.priority_citations. Use ONLY citations from the supplied catalog or write the doctrine without a citation.`,
    })
  }

  const exhaCite = parsed.exhaustion_analysis?.rule_citation
  if (!citePassesCatalog(exhaCite, exhaCatalog)) {
    errors.push({
      type: 'exhaustion_citation_not_in_catalog',
      message: `exhaustion_analysis.rule_citation (${exhaCite || ''}) does not match any case in state_rule.exhaustion_citations. Use ONLY citations from the supplied catalog.`,
    })
  }

  // 5. Allowed enum values
  const allowedTriggered = new Set(['yes', 'no', 'partial'])
  for (const t of trigList) {
    if (t && t.triggered && !allowedTriggered.has(t.triggered)) {
      errors.push({
        type: 'invalid_triggered_value',
        message: `trigger_analysis entry for ${t.policy_id} has triggered="${t.triggered}". Must be "yes", "no", or "partial".`,
      })
    }
  }
  const allowedRanks = new Set(['primary', 'co-primary', 'excess', 'sub-excess'])
  for (const r of ordered) {
    if (r && r.rank && !allowedRanks.has(r.rank)) {
      errors.push({
        type: 'invalid_rank_value',
        message: `priority_analysis entry for ${r.policy_id} has rank="${r.rank}". Must be "primary", "co-primary", "excess", or "sub-excess".`,
      })
    }
  }
  const allowedExhaustion = new Set(['vertical', 'horizontal', 'mixed', 'undetermined'])
  if (parsed.exhaustion_analysis?.rule && !allowedExhaustion.has(parsed.exhaustion_analysis.rule)) {
    errors.push({
      type: 'invalid_exhaustion_rule',
      message: `exhaustion_analysis.rule="${parsed.exhaustion_analysis.rule}". Must be "vertical", "horizontal", "mixed", or "undetermined".`,
    })
  }

  return errors
}

function asArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); return Array.isArray(j) ? j : [] } catch { return [] }
  }
  return []
}

// Build a corrective follow-up prompt for coverage_priority mode.
function buildCoveragePriorityRetryMessage(errors) {
  const lines = errors.map((e, i) => `  ${i + 1}. ${e.message}`).join('\n')
  return `Your previous answer failed the post-validation checks. Specifically:\n\n${lines}\n\nRules of correction:\n- Every input policy MUST have exactly one entry in trigger_analysis.\n- priority_analysis.ordered_policies MUST contain only policies whose triggered value is "yes" or "partial" — never "no".\n- All citations MUST come from state_rule.{trigger,priority,exhaustion}_citations. Do NOT introduce any case the catalog does not contain. If a section's catalog is empty, write the doctrine in general terms with the explicit phrase "no citation in catalog for this point."\n- Return the FULL corrected JSON object — same shape as before. No prose, no markdown fences.`
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
      // PDF reads are synchronous (not background-tasked), so a longer
      // per-attempt timeout is safe here.
      timeoutMs: 90_000,
      maxAttempts: 3,
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

// ── Mode: extract_matter ────────────────────────────────────────────────────
async function handleExtractMatter(supabase, storagePath) {
  if (!storagePath) throw new Error('storagePath required')
  const pdfB64 = await downloadAsBase64(supabase, 'lc-matter-docs', storagePath)
  const claudeResp = await callClaude({
    system: MATTER_INTAKE_SYSTEM,
    userContent: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
      { type: 'text', text: 'Extract the matter intake data from this PDF. Return only the JSON object — no prose.' },
    ],
    max_tokens: 4096,
  })
  const text = claudeResp.content?.[0]?.text || ''
  const parsed = parseJsonFromClaude(text)
  return { ok: true, parsed, storagePath }
}

// ── Mode: classify_document ─────────────────────────────────────────────────
// Reads any uploaded PDF (from either storage bucket) and returns its kind so
// the Analyzer UI can route it to the right extractor. Stateless — does not
// write to the database. The caller decides what to do with the result.
async function handleClassifyDocument(supabase, opts: { storagePath?: string, bucket?: string }) {
  const bucket      = opts.bucket || 'lc-matter-docs'
  const storagePath = opts.storagePath
  if (!storagePath) throw new Error('storagePath required')
  const pdfB64 = await downloadAsBase64(supabase, bucket, storagePath)
  const claudeResp = await callClaude({
    system: CLASSIFY_DOCUMENT_SYSTEM,
    userContent: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
      { type: 'text', text: 'Classify this PDF. Return only the JSON object — no prose.' },
    ],
    max_tokens: 1024,
  })
  const text = claudeResp.content?.[0]?.text || ''
  const parsed = parseJsonFromClaude(text)
  return { ok: true, parsed, storagePath, bucket }
}

// ── Mode: extract_allegations ───────────────────────────────────────────────
// Reads a complaint, petition, pre-suit demand letter, ROR, or claim summary
// and returns the matter shape + structured allegations array that drives the
// COVERAGE_PRIORITY engine. If matterId is supplied, writes the allegations
// + facts back to lc_matters; otherwise returns them inline so the caller can
// create the matter in a follow-up step.
async function handleExtractAllegations(supabase, opts: { storagePath?: string, matterId?: string }) {
  const storagePath = opts.storagePath
  if (!storagePath) throw new Error('storagePath required')
  const pdfB64 = await downloadAsBase64(supabase, 'lc-matter-docs', storagePath)
  const claudeResp = await callClaude({
    system: EXTRACT_ALLEGATIONS_SYSTEM,
    userContent: [
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfB64 } },
      { type: 'text', text: 'Extract the structured allegations from this document. Return only the JSON object — no prose.' },
    ],
    max_tokens: 4096,
  })
  const text = claudeResp.content?.[0]?.text || ''
  const parsed = parseJsonFromClaude(text)

  if (opts.matterId) {
    await supabase.from('lc_matters').update({
      allegations:      parsed.allegations ?? [],
      loss_type:        parsed.loss_type ?? null,
      loss_start_date:  parsed.loss_start_date ?? null,
      loss_end_date:    parsed.loss_end_date ?? null,
      venue_state:      parsed.venue_state ?? null,
      governing_state:  parsed.venue_state ?? null,  // default; user can override
      description:      parsed.description ?? null,
      raw_intake_extraction: parsed,
    }).eq('id', opts.matterId)
  }

  return { ok: true, parsed, storagePath, matterId: opts.matterId ?? null }
}

// ── Mode: allocate ──────────────────────────────────────────────────────────
//
// Split into two phases so the HTTP handler can return an analysisId
// immediately and then process the (slow) Claude validate+retry loop in the
// background via EdgeRuntime.waitUntil. The frontend polls lc_analyses.status
// for completion.

async function startAllocate(supabase, matterId, opts: any = {}) {
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

  // Resolve targeted_carriers (uuid[]) to a {policy_id, carrier, policy_number}[]
  // so Claude can reason about it without us trusting it to look up by UUID.
  const targetedIds = Array.isArray(matter.targeted_carriers) ? matter.targeted_carriers : []
  const targetedDetails = targetedIds
    .map(id => policies.find(p => p.id === id))
    .filter(Boolean)
    .map(p => ({ policy_id: p.id, carrier: p.carrier, policy_number: p.policy_number }))

  const userPayload = JSON.stringify({
    matter: {
      name:               matter.name,
      description:        matter.description ?? null,
      loss_type:          matter.loss_type,
      loss_start_date:    matter.loss_start_date,
      loss_end_date:      matter.loss_end_date,
      damages_exposure:   matter.damages_exposure,
      venue_state:        matter.venue_state,
      governing_state:    governingState,
      trigger_theory:     triggerTheory,
      targeted_carriers:  targetedDetails,  // [] = no targeted tender; non-empty = these are the only contributing carriers
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

  const insertRow: any = {
    org_id:           matter.org_id,
    matter_id:        matterId,
    governing_state:  governingState,
    trigger_theory:   triggerTheory,
    total_amount:     matter.damages_exposure,
    status:           'running',
  }
  if (opts.comparisonGroupId) insertRow.comparison_group_id = opts.comparisonGroupId

  const { data: analysis, error: aErr } = await supabase
    .from('lc_analyses')
    .insert(insertRow)
    .select()
    .single()
  if (aErr) throw aErr

  return { analysis, matter, policies, governingState, triggerTheory, userPayload }
}

async function processAllocate(supabase, ctx) {
  const { analysis, matter, policies, triggerTheory, userPayload } = ctx
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

// Convenience wrapper for synchronous (wait=true) callers — keeps the old
// behaviour of returning the full result.
async function handleAllocateSync(supabase, matterId, opts) {
  const ctx = await startAllocate(supabase, matterId, opts)
  return await processAllocate(supabase, ctx)
}

// ── Mode: coverage_priority ─────────────────────────────────────────────────
//
// Replaces ALLOCATE for new analyses. Produces a Trigger / Priority /
// Exhaustion opinion plus a 2-3 paragraph narrative. Same two-phase shape as
// allocate (start = build the analysis row + payload synchronously; process =
// run the validate-and-retry loop in the background via EdgeRuntime.waitUntil
// so the HTTP handler returns an analysisId immediately and the frontend
// polls lc_analyses.status).

async function startCoveragePriority(supabase, matterId, opts: any = {}) {
  const { data: matter } = await supabase
    .from('lc_matters')
    .select('*, lc_matter_policies(policy_id, role, lc_policies(*, lc_policy_endorsements(*), lc_policy_exclusions(*)))')
    .eq('id', matterId)
    .single()
  if (!matter) throw new Error('Matter not found')

  const policies = (matter.lc_matter_policies || []).map((mp) => mp.lc_policies).filter(Boolean)
  const governingState = opts.governingStateOverride || matter.governing_state
  if (!governingState) throw new Error('Matter has no governing_state')
  if (!policies.length) throw new Error('Matter has no policies attached')

  const { data: rule } = await supabase
    .from('lc_state_law_rules')
    .select('*')
    .eq('state_code', governingState)
    .maybeSingle()

  const userPayload = JSON.stringify({
    matter: {
      name:            matter.name,
      description:     matter.description ?? null,
      loss_type:       matter.loss_type,
      loss_start_date: matter.loss_start_date,
      loss_end_date:   matter.loss_end_date,
      venue_state:     matter.venue_state,
      governing_state: governingState,
      allegations:     Array.isArray(matter.allegations) ? matter.allegations : asArray(matter.allegations),
    },
    state_rule: rule
      ? {
          state_code:           rule.state_code,
          name:                 rule.name,
          trigger_test:         rule.trigger_test ?? null,
          trigger_citations:    asArray(rule.trigger_citations),
          priority_rule:        rule.priority_rule ?? null,
          priority_citations:   asArray(rule.priority_citations),
          exhaustion_rule_text: rule.exhaustion_rule_text ?? null,
          exhaustion_citations: asArray(rule.exhaustion_citations),
        }
      : null,
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
      // Send label + effect only (not full text) — the full endorsement/exclusion
      // language can be thousands of tokens per policy and causes generation to
      // exceed Supabase's 150s wall-clock budget. The coverage-priority engine
      // needs to know WHAT the endorsement does (effect + label), not every word.
      endorsements: (p.lc_policy_endorsements || []).map((e) => ({
        endorsement_no: e.endorsement_no,
        label:          e.label,
        effect:         e.effect,
      })),
      exclusions: (p.lc_policy_exclusions || []).map((e) => ({
        label: e.label,
      })),
      has_anti_stacking_clause:           !!p.has_anti_stacking_clause,
      has_non_cumulation_clause:          !!p.has_non_cumulation_clause,
      has_continuous_trigger_endorsement: !!p.has_continuous_trigger_endorsement,
    })),
  })

  const insertRow: any = {
    org_id:          matter.org_id,
    matter_id:       matterId,
    mode:            'coverage_priority',
    governing_state: governingState,
    status:          'running',
  }
  if (opts.comparisonGroupId) insertRow.comparison_group_id = opts.comparisonGroupId

  const { data: analysis, error: aErr } = await supabase
    .from('lc_analyses')
    .insert(insertRow)
    .select()
    .single()
  if (aErr) throw aErr

  return { analysis, matter, policies, rule, governingState, userPayload }
}

async function processCoveragePriority(supabase, ctx) {
  const { analysis, matter, policies, rule, userPayload } = ctx
  try {
    // Budget math: 2 validation attempts × 1 internal attempt × 90s timeout = 180s max.
    // maxAttempts:1 disables internal retries inside callClaudeMessages — the outer
    // validation loop is already the retry mechanism so doubling up wastes budget.
    // max_tokens:2048 halves generation time vs 4096 (coverage opinion fits in 2048).
    const MAX_ATTEMPTS = 2
    const conversation = [{ role: 'user', content: [{ type: 'text', text: userPayload }] }]
    let parsed: any = null
    let validationErrors: any[] = []
    let attempt = 0

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      const claudeResp = await callClaudeMessages(COVERAGE_PRIORITY_SYSTEM, conversation, 5000, { timeoutMs: 90_000, maxAttempts: 2 })
      const text = claudeResp.content?.[0]?.text || ''
      try {
        parsed = parseJsonFromClaude(text)
      } catch (e) {
        validationErrors = [{
          type: 'parse_error',
          message: `Your previous response was not valid JSON: ${String(e).slice(0, 200)}`,
        }]
        conversation.push({ role: 'assistant', content: text })
        conversation.push({ role: 'user', content: buildCoveragePriorityRetryMessage(validationErrors) })
        continue
      }
      validationErrors = validateCoveragePriority(parsed, matter, policies, rule)
      if (validationErrors.length === 0) break

      conversation.push({ role: 'assistant', content: text })
      conversation.push({ role: 'user', content: buildCoveragePriorityRetryMessage(validationErrors) })
    }

    const validationStatus = validationErrors.length === 0 ? 'valid' : 'needs_review'

    // Update the analysis row with the opinion-shape fields.
    await supabase.from('lc_analyses').update({
      narrative:                 parsed?.narrative ?? null,
      priority_rule_applied:     parsed?.priority_analysis?.rule_applied ?? null,
      priority_rule_citation:    parsed?.priority_analysis?.rule_citation ?? null,
      exhaustion_rule:           parsed?.exhaustion_analysis?.rule ?? null,
      exhaustion_rule_citation:  parsed?.exhaustion_analysis?.rule_citation ?? null,
      mutually_repugnant_groups: parsed?.priority_analysis?.mutually_repugnant_groups ?? null,
      status:                    'complete',
      raw_engine_output:         parsed,
      validation_status:         validationStatus,
      validation_errors:         validationErrors.length > 0 ? validationErrors : null,
      validation_attempts:       attempt,
    }).eq('id', analysis.id)

    // Replace any existing rows from a previous attempt
    await supabase.from('lc_analysis_results').delete().eq('analysis_id', analysis.id)

    // Build per-policy result rows: trigger fields for every policy + (if ranked) priority fields.
    const triggerByPolicy = new Map<string, any>()
    for (const t of (parsed?.trigger_analysis || [])) {
      if (t?.policy_id) triggerByPolicy.set(t.policy_id, t)
    }
    const priorityByPolicy = new Map<string, any>()
    for (const r of (parsed?.priority_analysis?.ordered_policies || [])) {
      if (r?.policy_id) priorityByPolicy.set(r.policy_id, r)
    }

    // Map Claude's policy_id back to a real policies.id where possible
    const byKey = new Map<string, string>()
    for (const p of policies) {
      byKey.set(p.id, p.id)
      byKey.set(`${(p.carrier || '').trim()}|${(p.policy_number || '').trim()}`, p.id)
    }
    const resolvePolicyId = (claudeId, carrier, policyNumber) => {
      if (claudeId && byKey.has(claudeId)) return claudeId
      const k = `${(carrier || '').trim()}|${(policyNumber || '').trim()}`
      if (byKey.has(k)) return byKey.get(k)
      for (const p of policies) {
        if ((p.policy_number || '').trim() === (policyNumber || '').trim()) return p.id
      }
      return null
    }

    const rows: any[] = []
    let ordering = 0
    for (const p of policies) {
      const t = triggerByPolicy.get(p.id) || null
      const r = priorityByPolicy.get(p.id) || null
      rows.push({
        analysis_id:                       analysis.id,
        policy_id:                         resolvePolicyId(p.id, p.carrier, p.policy_number),
        carrier:                           p.carrier,
        policy_number:                     p.policy_number,
        policy_effective:                  p.effective_date,
        policy_expiration:                 p.expiration_date,
        policy_state_issued:               p.state_issued,
        triggered:                         t?.triggered ?? null,
        allegations_implicating_coverage:  t?.allegations_implicating_coverage ?? [],
        coverage_grant_basis:              t?.coverage_grant_basis ?? null,
        exclusions_considered:             t?.exclusions_considered ?? [],
        trigger_rationale:                 t?.rationale ?? null,
        priority_rank:                     r?.rank ?? null,
        priority_rank_basis:               r?.rank_basis ?? null,
        other_insurance_quote:             r?.other_insurance_quote ?? null,
        rationale:                         r?.rank_basis ?? t?.rationale ?? null,
        ordering:                          ordering++,
      })
    }

    if (rows.length) {
      await supabase.from('lc_analysis_results').insert(rows)
    }

    return {
      ok: true,
      analysisId: analysis.id,
      mode: 'coverage_priority',
      validation_status: validationStatus,
      validation_attempts: attempt,
      validation_errors: validationErrors,
    }
  } catch (e) {
    await supabase.from('lc_analyses').update({
      status: 'failed',
      error:  String(e?.message || e).slice(0, 1000),
    }).eq('id', analysis.id)
    throw e
  }
}

async function handleCoveragePrioritySync(supabase, matterId, opts) {
  const ctx = await startCoveragePriority(supabase, matterId, opts)
  return await processCoveragePriority(supabase, ctx)
}

// ── HTTP entrypoint ─────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const { mode, policyId, matterId, governingStateOverride, triggerTheoryOverride, comparisonStates, comparisonGroupId, storagePath, bucket, wait } = await req.json()

    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })

    if (mode === 'extract_terms') {
      if (!policyId) throw new Error('policyId required')
      const out = await handleExtract(supabase, policyId)
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'extract_matter') {
      const out = await handleExtractMatter(supabase, storagePath)
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'classify_document') {
      const out = await handleClassifyDocument(supabase, { storagePath, bucket })
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'extract_allegations') {
      const out = await handleExtractAllegations(supabase, { storagePath, matterId })
      return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'allocate') {
      if (!matterId) throw new Error('matterId required')

      // Multi-scenario comparison: kick off N analyses with one shared group id
      if (Array.isArray(comparisonStates) && comparisonStates.length >= 2) {
        // @ts-ignore — Deno crypto.randomUUID
        const comparisonGroupId = crypto.randomUUID()
        const ctxs = []
        for (const s of comparisonStates) {
          try {
            const ctx = await startAllocate(supabase, matterId, {
              governingStateOverride: s,
              triggerTheoryOverride,
              comparisonGroupId,
            })
            ctxs.push(ctx)
          } catch (e) {
            console.error('startAllocate failed for', s, e)
          }
        }
        // Schedule all N background runs
        const allWork = Promise.all(ctxs.map(ctx =>
          processAllocate(supabase, ctx).catch(async (e) => {
            console.error('processAllocate failed', ctx.governingState, e)
            try {
              await supabase.from('lc_analyses').update({
                status: 'failed',
                error: String(e?.message || e).slice(0, 1000),
              }).eq('id', ctx.analysis.id)
            } catch {}
          })
        ))
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(allWork)
        }
        return new Response(JSON.stringify({
          ok: true,
          comparisonGroupId,
          analysisIds: ctxs.map(c => c.analysis.id),
          status: 'running',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      const opts = { governingStateOverride, triggerTheoryOverride }

      // Sync mode for testing / callers that need the full result inline
      if (wait === true) {
        const out = await handleAllocateSync(supabase, matterId, opts)
        return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Default: async — return analysisId immediately and process in background
      const ctx = await startAllocate(supabase, matterId, opts)
      const work = processAllocate(supabase, ctx).catch(async (e) => {
        console.error('processAllocate failed', e)
        try {
          await supabase.from('lc_analyses').update({
            status: 'failed',
            error:  String(e?.message || e).slice(0, 1000),
          }).eq('id', ctx.analysis.id)
        } catch (innerErr) {
          console.error('failed to mark analysis failed', innerErr)
        }
      })

      // Keep the function alive after returning so the work can finish.
      // EdgeRuntime is provided by Supabase's Deno runtime; the typeof guard
      // means tests/local Deno still work (the work just runs synchronously).
      // @ts-ignore — EdgeRuntime is a Supabase global
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(work)
      }

      return new Response(JSON.stringify({
        ok: true,
        analysisId: ctx.analysis.id,
        status: 'running',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    if (mode === 'coverage_priority') {
      if (!matterId) throw new Error('matterId required')

      // Multi-state comparison: kick off N analyses with one shared group id.
      // The caller may supply an existing comparisonGroupId to extend a prior
      // single-state opinion into a comparison; otherwise we mint a new uuid.
      if (Array.isArray(comparisonStates) && comparisonStates.length >= 2) {
        // @ts-ignore — Deno crypto.randomUUID
        const groupId = comparisonGroupId || crypto.randomUUID()
        const ctxs: any[] = []
        for (const s of comparisonStates) {
          try {
            const ctx = await startCoveragePriority(supabase, matterId, {
              governingStateOverride: s,
              comparisonGroupId: groupId,
            })
            ctxs.push(ctx)
          } catch (e) {
            console.error('startCoveragePriority failed for', s, e)
          }
        }
        const allWork = Promise.all(ctxs.map(ctx =>
          processCoveragePriority(supabase, ctx).catch(async (e) => {
            console.error('processCoveragePriority failed', ctx.governingState, e)
            try {
              await supabase.from('lc_analyses').update({
                status: 'failed',
                error:  String(e?.message || e).slice(0, 1000),
              }).eq('id', ctx.analysis.id)
            } catch {}
          })
        ))
        // @ts-ignore
        if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
          // @ts-ignore
          EdgeRuntime.waitUntil(allWork)
        }
        return new Response(JSON.stringify({
          ok: true,
          comparisonGroupId: groupId,
          analysisIds: ctxs.map(c => c.analysis.id),
          status: 'running',
        }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Single-state — caller may still pass comparisonGroupId to attach this
      // analysis to an existing group (for "compare under another jurisdiction"
      // from the result page).
      const opts: any = { governingStateOverride }
      if (comparisonGroupId) opts.comparisonGroupId = comparisonGroupId

      if (wait === true) {
        const out = await handleCoveragePrioritySync(supabase, matterId, opts)
        return new Response(JSON.stringify(out), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // Default: async — return analysisId immediately and process in background
      const ctx = await startCoveragePriority(supabase, matterId, opts)
      const work = processCoveragePriority(supabase, ctx).catch(async (e) => {
        console.error('processCoveragePriority failed', e)
        try {
          await supabase.from('lc_analyses').update({
            status: 'failed',
            error:  String(e?.message || e).slice(0, 1000),
          }).eq('id', ctx.analysis.id)
        } catch (innerErr) {
          console.error('failed to mark analysis failed', innerErr)
        }
      })

      // @ts-ignore — EdgeRuntime is a Supabase global
      if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime?.waitUntil) {
        // @ts-ignore
        EdgeRuntime.waitUntil(work)
      }

      return new Response(JSON.stringify({
        ok: true,
        analysisId: ctx.analysis.id,
        status: 'running',
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
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
