# LexClause — Analysis Engine Specification

> The design doc for the policy ingestion + allocation engine. Read alongside `frontend/src/lib/stateLaw.js` and `supabase/functions/analyze-policy/index.ts`.

## Goals

LexClause should answer, defensibly, the question: **"Given these policies, this loss, and this controlling state law — how should the carriers share?"**

The output should be (1) a per-carrier dollar allocation and (2) a methodology memo that a coverage attorney would sign their name to. Either everything in the analysis is documentable, or it gets flagged as undetermined.

## Two-layer architecture

```
┌────────────────────────────────────────────────────────────────────┐
│  Layer 1 — Claude (extraction & memo drafting)                     │
│                                                                    │
│  • Parses policy PDFs into structured fields                       │
│  • Writes the methodology memo at the end                          │
│  • NEVER decides shares unilaterally — it executes a chosen rule  │
└────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌────────────────────────────────────────────────────────────────────┐
│  Layer 2 — Deterministic rules (allocation math + state law)       │
│                                                                    │
│  • Coded state-law catalog (stateLaw.js + pa_state_law_rules)      │
│  • Coded allocation algorithms (pro-rata-time, all-sums, etc.)     │
│  • Reconciles other-insurance clauses with controlling law         │
└────────────────────────────────────────────────────────────────────┘
```

The reason for the split: an LLM is good at reading prose and producing prose. It is not good at math under audit, and it is not appropriate for picking a binding legal rule. Coverage attorneys need to see the rule in code, not in a prompt.

## Step-by-step pipeline

### 1. Ingest policies

User uploads PDFs to `pa-policies` storage bucket. For each PDF:

1. Extract raw text (pdf-parse, pdftotext, or Anthropic's PDF input API).
2. Pass text to Claude with the **EXTRACT_SYSTEM** prompt (see Edge Function).
3. Claude returns a strict-shape JSON object — limits, dates, other-insurance clause verbatim, endorsements, exclusions, and a handful of boolean flags (anti-stacking, non-cumulation, etc.).
4. Persist into `pa_policies` + child tables. Status moves `pending → extracting → complete | failed`.

### 2. Define the matter

User creates a `pa_matter`, fills in:

- **Loss type** (environmental / construction defect / asbestos / cyber / etc.)
- **Loss start & end dates** — drives time-on-risk math
- **Damages exposure** in USD
- **Venue state** (where suit is filed)
- **Insured HQ state**
- **Loss location states** (multi)
- **Governing state** — the user's choice for controlling law
- Optional **trigger theory** override (otherwise pick the state's default)

User attaches policies via `pa_matter_policies`.

### 3. Choice-of-law screening

`candidateJurisdictions()` in `stateLaw.js` returns every state that could plausibly govern: states where any policy was issued + the venue + the insured's HQ + each loss location. LexClause surfaces these as chips so the user can pick the controlling law (or run multiple analyses, one per candidate).

### 4. Identify the trigger of coverage

Per state default in `STATE_RULES[code].trigger`. Common patterns:

- **Continuous trigger** — every policy on the risk during the entire injury period is triggered. Common in long-tail (asbestos, environmental, construction defect).
- **Injury-in-fact** — only policies in force when actual injury occurred (NY).
- **Manifestation** — only the policy in force when damage was discovered (PA tends here).
- **Exposure** — only policies during the period of exposure to the harmful condition.
- **Actual injury** — TX's Don's Building Supply rule for property damage.

User can override the default for the matter.

### 5. Apply the allocation method

The state's `defaultMethod` (or an override) selects the algorithm:

- **`pro_rata_time_on_risk`** (NY, NJ, MA, FL, PA): each triggered policy pays a share equal to (its days on risk) ÷ (total days of injury). Optionally weighted by limits (NJ Owens-Illinois).
- **`pro_rata_by_limits`** (TX): each policy's share is its limit ÷ the sum of triggered-policy limits.
- **`all_sums`** (CA, OH, WA): the insured may select any single triggered policy and demand full payment up to limits. That carrier then has rights of contribution.
- **`all_sums_with_reallocation`**: like all-sums but with mandatory subsequent reallocation among co-insurers.
- **`equal_shares`** (default fallback for some other-insurance pro-rata clauses): split evenly among co-primaries.
- **`targeted_tender`** (IL): the insured selectively tenders to one or some carriers; targeted carriers split equally; non-targeted carriers do not contribute.

### 6. Reconcile other-insurance clauses

Each policy has its own "other insurance" language: PRIMARY, EXCESS, PRO_RATA, ESCAPE, EXCESS_OVER_OTHER, or SILENT. When two policies' clauses are mutually repugnant (each says it's excess to the other, classic "circular escape" problem), most jurisdictions ignore both clauses and apply the state's default (often pro-rata or equal shares).

Build the resolution as a small decision table per pair of policies. Document each pair-resolution in the methodology memo.

### 7. Apply horizontal vs. vertical exhaustion

When excess/umbrella policies are stacked:

- **Horizontal exhaustion** (NY, NJ): all underlying primary policies must be exhausted before any excess attaches.
- **Vertical exhaustion** (CA Montrose II, IL): the insured may exhaust each tower vertically — primary → umbrella → excess in one year — without first exhausting other years' primaries.

Catalog this in `STATE_RULES[code].horizontalExhaustion`.

### 8. Allocate across SIRs and deductibles

Self-insured retentions and deductibles eat into the insured's exposure first. Order of operations:

1. Apply per-policy SIR/deductible.
2. Apply per-policy limits as caps.
3. Apply per-policy attachment points (excess/umbrella).

### 9. Generate the methodology memo

Claude takes the matter facts + state rule + per-policy results and produces a 1-3 paragraph memo: trigger choice, allocation method, why this rule applies in the controlling state, with at least one citation. The Edge Function stores it on `pa_analyses.methodology_text`.

## Output shape

```jsonc
{
  "allocation_method": "pro_rata_time_on_risk",
  "trigger_theory":    "continuous_trigger",
  "results": [
    {
      "policy_id": "<uuid>",
      "carrier":   "Chubb",
      "policy_number": "GL-001",
      "policy_effective":  "2018-01-01",
      "policy_expiration": "2019-01-01",
      "policy_state_issued": "NJ",
      "share_pct":        0.20,
      "allocated_amount": 200000,
      "rationale":        "Triggered for 365 of 1,825 total injury days. Owens-Illinois pro-rata."
    }
    /* ... one row per triggered policy ... */
  ],
  "methodology_text": "<1-3 paragraph memo with citations>"
}
```

## Edge cases the engine must surface (not silently swallow)

- **Damages exposure unknown** → `allocation_method = "undetermined"`. Memo explains.
- **No policy in force during part of the injury period** → "self-insured years" — the insured pays that share; flag prominently.
- **Choice of law is genuinely contested** → run two analyses; show both side-by-side; do not pick a winner.
- **Conflicting other-insurance clauses** → apply the state's default; explain the conflict in the memo.
- **Anti-stacking endorsements** → cap the carrier's exposure even if multiple policies are triggered.
- **Known-loss / prior-acts exclusions** → flag the policy as potentially excluded; let the user decide.

## Extension hooks

- Per-org **state-law overrides** — `pa_state_law_rules` is mutable; some firms will want their own house rules.
- **Carter-Wallace allocation** (NJ) — special pro-rata algorithm for continuous-trigger asbestos cases. Add as a separate method when needed.
- **Excess "drop-down" coverage** when underlying carriers are insolvent.
- **Cross-matter precedent search** — surface prior LexClause analyses by the same carrier on the same loss type.

## Out of scope (for now)

- Lloyd's syndicate-by-syndicate allocation
- Reinsurance treaties
- D&O / E&O claims-made-and-reported policy interactions (different mental model — separate engine module)
- Foreign jurisdictions
