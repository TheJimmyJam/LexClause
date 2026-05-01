# LexClause — Claude Session Reference

Coverage-allocation analysis: how should multiple insurance policies share a single loss given the policy language, the trigger of coverage, and the controlling state law?

## Folder layout

LexClause lives at the repo root. **What I edit locally is what gets pushed.** Path translation is 1:1 — no nested duplicate folder, no special path mapping.

```
LexClause/                              ← local + repo root
├── frontend/                          ← Netlify build base
│   ├── src/{components,context,hooks,lib,pages}
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   └── index.html
├── supabase/
│   ├── migrations/001..010_*.sql
│   └── functions/analyze-policy/index.ts
├── docs/
│   ├── ANALYSIS_SPEC.md
│   └── STATE_LAW_REFERENCE.md
├── netlify.toml                        ← base = "frontend"
├── README.md
└── CLAUDE.md
```

## Stack

- **Frontend**: React + Vite + Tailwind CSS (`darkMode: 'class'`, brand = teal)
- **Backend**: Supabase — its own dedicated project (no shared backends with LexAlloc)
- **Tables**: prefixed `lc_` (policy-allocation namespace; the prefix is internal — users never see it)
- **AI engine**: Edge Function `analyze-policy` calls Claude API. Frontend never touches the Anthropic key.
- **Deploy**: Netlify, auto-deploys from GitHub `main`
- **Repo**: `TheJimmyJam/LexClause`

## Routes

| Route                                                           | File              | Purpose |
|-----------------------------------------------------------------|-------------------|---------|
| `/`                                                             | Landing.jsx       | Marketing landing |
| `/login`, `/register`, `/forgot-password`                       | Login/Register/ForgotPassword | Auth |
| `/dashboard`                                                    | Dashboard.jsx     | Counts and quick actions |
| `/policies`                                                     | Policies.jsx      | Policy library |
| `/policies/upload`                                              | PolicyUpload.jsx  | PDF dropzone → Edge Function extraction |
| `/policies/:policyId`                                           | PolicyDetail.jsx  | Extracted fields, endorsements, exclusions, re-run extraction |
| `/matters`                                                      | Matters.jsx       | List of coverage matters |
| `/matters/intake`                                               | MatterIntake.jsx  | Upload FNOL/ROR/complaint PDF → auto-fill matter form, match carriers to existing policies |
| `/matters/:matterId`                                            | MatterDetail.jsx  | Loss facts, jurisdictions, attached policies, targeted-tender selection, run analysis or comparison |
| `/matters/:matterId/analysis/:analysisId`                       | Analysis.jsx      | Per-carrier shares, tower explanation, methodology memo, .docx/.pdf export |
| `/matters/:matterId/compare/:comparisonGroupId`                 | Comparison.jsx    | Side-by-side multi-state allocation results from one matter |
| `/settings`                                                     | Settings.jsx      | Profile + org info |

## Key files

- `src/lib/supabase.js`             — Supabase client
- `src/lib/policyAnalysis.js`       — Frontend wrapper for the `analyze-policy` Edge Function (extract_terms / allocate / extract_matter)
- `src/lib/stateLaw.js`             — State-law catalog (mirrored to `lc_state_law_rules`)
- `src/lib/generateCoverageMemo.js` — Builds and downloads .docx + .pdf coverage opinion memos from an analysis
- `src/hooks/useAuth.jsx`           — Reads from `lc_profiles` + `lc_organizations`
- `supabase/migrations/001..010_*.sql` — See migrations section below
- `supabase/functions/analyze-policy/index.ts` — Three modes: `extract_terms`, `extract_matter`, `allocate`

## Edge Function — four modes

`supabase/functions/analyze-policy/index.ts`

1. **`extract_terms`** — Reads a stored policy PDF and writes structured fields (carrier, limits, attachment_point, SIR, other-insurance type, endorsements, exclusions, anti-stacking flags, etc.) back to `lc_policies`. Uses Anthropic's native PDF input (no separate OCR step).
2. **`extract_matter`** — Reads an FNOL / ROR / complaint / pre-suit demand / claim summary PDF and pre-fills the matter form (loss type, dates, damages, venue, carriers mentioned). User reviews and confirms before saving.
3. **`coverage_priority`** *(primary engine as of v0.3)* — Combines matter (with structured allegations) + policies + governing-state rule into a three-section legal opinion: Trigger / Priority / Exhaustion plus a 2-3 paragraph narrative. Does NOT allocate dollars — answers the threshold legal question of which policies are triggered (Hinshaw-style duty-to-defend layer) and in what priority order they respond (Other Insurance + state-specific rule). Runs a validate-and-retry loop (every input policy has a trigger entry, priority only includes triggered policies, citations only from catalog) up to 3 attempts. Background-processed via `EdgeRuntime.waitUntil`. Accepts `comparisonStates: ['CA','NY',...]` for multi-state comparison.
4. **`allocate`** *(legacy)* — Tower-aware dollar allocation. Preserved for backward compatibility with existing analyses created before the v0.3 pivot. New analyses default to `coverage_priority`. The dollar columns on `lc_analyses` and `lc_analysis_results` remain in place for legacy data.

## Database — lc_ tables

| Table                      | Purpose |
|----------------------------|---------|
| `lc_organizations`         | Tenant — one per signed-up firm |
| `lc_profiles`              | One row per auth.users user; links to org_id |
| `lc_policies`              | Policy library: limits, retentions, attachment_point, other-insurance language, anti-stacking flags, extraction_status, raw_extraction |
| `lc_policy_endorsements`   | Per-policy endorsements with effect (BROADENS / RESTRICTS / NEUTRAL) |
| `lc_policy_exclusions`     | Per-policy exclusions |
| `lc_matters`               | Coverage matters: loss facts, jurisdictions, governing state, `targeted_carriers uuid[]`, source-document fields, **`allegations jsonb` (v0.3)** — array of structured allegations driving the trigger analysis |
| `lc_matter_policies`       | Many-to-many: which policies are subject to a matter (with role) |
| `lc_analyses`              | One row per analysis. v0.3 fields: `mode` (allocation\|coverage_priority), `narrative`, `priority_rule_applied`, `priority_rule_citation`, `exhaustion_rule`, `exhaustion_rule_citation`, `mutually_repugnant_groups`, plus `validation_status`, `validation_errors`, `validation_attempts`, `comparison_group_id`. Legacy dollar fields kept nullable. |
| `lc_analysis_results`      | Per-policy result rows. v0.3 fields: `triggered`, `allegations_implicating_coverage`, `coverage_grant_basis`, `exclusions_considered`, `trigger_rationale`, `priority_rank`, `priority_rank_basis`, `other_insurance_quote`. Legacy dollar fields (layer, attachment_point, allocated_amount, share_pct, applicable_limit) kept nullable for backward compat. |
| `lc_state_law_rules`       | State-law catalog. Old fields (`default_method`, `default_trigger`, `horizontal_exhaustion`, `citations`) drive legacy `allocate` mode. New fields (mig 011: `trigger_test`, `trigger_citations`, `priority_rule`, `priority_citations`, `exhaustion_rule_text`, `exhaustion_citations`) drive `coverage_priority` mode. |

RLS gating: every lc_ table is gated by `org_id = lc_user_org()`, where `lc_user_org()` returns `lc_profiles.org_id` for `auth.uid()`.

Storage buckets:
- `lc-policies` — policy PDFs at `<org_id>/<timestamp>-<filename>.pdf`
- `lc-matter-docs` — FNOL/ROR/complaint PDFs for matter intake at `<org_id>/<timestamp>-<filename>.pdf`

Signup flow: `Register.jsx` calls `supabase.auth.signUp()` with `org_name`, `first_name`, and `last_name` in `raw_user_meta_data`. The `handle_new_lexclause_user()` trigger on `auth.users` creates the `lc_organizations` row and the `lc_profiles` row in one shot, with the new user as `admin` of their fresh org.

## Migrations

| #   | File                              | What it does |
|-----|-----------------------------------|--------------|
| 001 | `001_lexclause_init.sql`          | All lc_ tables + RLS + signup trigger + initial 10-state seed + `lc-policies` storage bucket |
| 002 | `002_tower_fields.sql`            | Adds `insured_retention`, `tower_explanation` to `lc_analyses`; `layer`, `attachment_point`, `applicable_limit` to `lc_analysis_results` |
| 003 | `003_validation_fields.sql`       | Adds `validation_status`, `validation_errors`, `validation_attempts` to `lc_analyses` |
| 004 | `004_seed_citations.sql`          | Vetted state-supreme-court citations on `lc_state_law_rules` (CA, NJ, NY, IL, MA, PA, TX, FL, WA, OH) |
| 005 | `005_more_states.sql`             | Tier-2 states: CT, CO, MN, IN, WI, MO, DE, NC, GA, OR |
| 006 | `006_targeted_carriers.sql`       | Adds `lc_matters.targeted_carriers uuid[]` for selective-tender enforcement |
| 007 | `007_md_mi_va.sql`                | Adds MD, MI, VA to state-law catalog |
| 008 | `008_comparison_groups.sql`       | Adds `lc_analyses.comparison_group_id` for multi-state comparisons |
| 009 | `009_matter_intake.sql`           | Adds source-document columns to `lc_matters` + `lc_matter-docs` storage bucket |
| 010 | `010_more_states_round3.sql`      | Tier-3 states: NH, VT, RI, HI, ME, LA, TN, SC, IA, KY |
| 011 | `011_coverage_priority.sql`       | **Pivot to coverage-priority schema.** Adds `trigger_test`/`priority_rule`/`exhaustion_rule_text` narratives + separated citation arrays on `lc_state_law_rules`. Adds `mode`, `narrative`, priority/exhaustion fields on `lc_analyses`. Adds `triggered`, `priority_rank`, etc. on `lc_analysis_results`. Adds `allegations jsonb` to `lc_matters`. Old dollar columns kept nullable. |

State-law catalog now covers ~33 states under the legacy schema. **The new coverage-priority schema (mig 011) needs trigger/priority/exhaustion narratives + citation arrays seeded per state — current catalog is empty for those new columns.** Catalog rebuild is a follow-up step.

## GitHub Push Script Template

```python
import urllib.request, urllib.error, json, base64

# Read PAT from ~/Desktop/Projects/.credentials (GITHUB_PAT_CLASSIC)
PAT   = 'ghp_xxxx...'
OWNER = 'TheJimmyJam'
REPO  = 'LexClause'
BASE  = f'https://api.github.com/repos/{OWNER}/{REPO}/contents'
H     = {'Authorization': f'token {PAT}', 'Accept': 'application/vnd.github.v3+json', 'Content-Type': 'application/json'}

def get_sha(path):
    req = urllib.request.Request(f'{BASE}/{path}', headers=H)
    try:
        with urllib.request.urlopen(req) as r: return json.loads(r.read())['sha']
    except urllib.error.HTTPError as e:
        if e.code == 404: return None
        raise

def push(repo_path, local_path, msg):
    with open(local_path, 'rb') as f: content = base64.b64encode(f.read()).decode()
    sha  = get_sha(repo_path)
    body = {'message': msg, 'content': content}
    if sha: body['sha'] = sha
    data = json.dumps(body).encode()
    req  = urllib.request.Request(f'{BASE}/{repo_path}', data=data, headers=H, method='PUT')
    with urllib.request.urlopen(req) as r: print(f'✓ {repo_path} ({r.status})')
```

## Netlify build config (repo root netlify.toml)

```toml
[build]
  base    = "frontend"
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "20"

[[redirects]]
  from   = "/*"
  to     = "/index.html"
  status = 200
```

## Required environment variables

**Netlify (frontend)**
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Supabase Edge Function `analyze-policy` secrets**
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional, default `claude-sonnet-4-6`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

## v0.3 product direction

LexClause and LexAlloc are independent products that happen to share a naming convention. **No data, auth, or workflow is shared between them.** LexClause's job is *coverage priority*: read a complaint / pre-suit demand / ROR + N policies, return a Trigger / Priority / Exhaustion opinion under the controlling state's law. Allocation (dollar apportionment) is intentionally out of scope for LexClause and lives in LexAlloc.

**Treatise references.** Hinshaw & Culbertson's *Duty to Defend: A Fifty-State Survey* (3d ed.) is the topology source for the trigger layer (single-insurer duty-to-defend mechanics across 50 states). It explicitly does NOT cover priority / Other Insurance / exhaustion — Hinshaw points to Seaman & Schulze's *Allocation of Losses in Complex Insurance Coverage Claims* (13th ed.) for that. The catalog rebuild uses both treatises as topology to identify the controlling cases per state, then cites the underlying cases (which are public). No treatise text is lifted.

## Pending / known gaps

- **State-law catalog rebuild for v0.3.** Migration 011 added the new columns. They're empty. Need to research and seed `trigger_test` + `trigger_citations` (Hinshaw topology), `priority_rule` + `priority_citations` (primary case research), `exhaustion_rule_text` + `exhaustion_citations` (primary case research) for the same ~33 states already in the legacy catalog. Hand-crafted state rules for NY/TX/CA exist as test fixtures in `docs/coverage_priority/state_rules/`.
- **Frontend rework for coverage_priority.** Analysis.jsx today renders the dollar table. It needs three labeled sections (Trigger / Priority / Exhaustion) + the narrative paragraph. Matter detail page needs to swap "damages exposure" for "trigger document upload" and surface allegations. Memo export rewritten as a coverage-priority opinion (not an apportionment memo).
- **Allegation extraction.** The `extract_matter` mode extracts loss facts but doesn't pull structured allegations. Either augment that prompt or add a sister `extract_allegations` mode that pulls `[{count, theory_of_liability, conduct_alleged, harm_type}, ...]` from a complaint / pre-suit demand / ROR. That output writes to `lc_matters.allegations` (mig 011).
- **Multi-state comparison UI for priority.** The edge function already accepts `comparisonStates: [...]` in coverage_priority mode. Comparison.jsx is hard-coded for the dollar-allocation shape — needs a rebuild as a per-state Trigger/Priority/Exhaustion comparison view.
- **Clause conflict detection.** Mostly subsumed by the priority engine — the engine flags mutually-repugnant Other Insurance clauses with a default rule per state. Surface this prominently in the UI rather than building a separate feature.
- **Endorsement impact analyzer.** Endorsements are stored with `effect: BROADENS|RESTRICTS|NEUTRAL`. Surface "this endorsement materially shifts the other-insurance posture" on PolicyDetail.jsx.
- **Coverage stack visualization.** Per-policy effective/expiration + layer + attachment_point still exist. Timeline-with-layers SVG is still a useful visual, but adapted to the priority world (color-code by triggered/not-triggered + priority rank instead of dollar amounts).
- **Missing-info detection.** Cheap win — flag policies where `extraction_status='complete'` but key fields are null.
- **ROR / denial letter variants.** Extension of memo export. Templated variants from the same analysis data.
- **Citation verifier.** The COVERAGE_PRIORITY_SYSTEM prompt forbids inventing citations and pins Claude to `state_rule.{trigger,priority,exhaustion}_citations`. The engine validator checks citations match the catalog by case-name substring. No external Westlaw/Lexis cross-check yet.
- **State-law catalog scope.** Tier-4 states (AL, AK, AZ, AR, ID, KS, MS, MT, NE, NV, NM, ND, OK, SD, UT, WV, WY, DC, etc.) intentionally undetermined until a real matter forces the research.

## Brand color

LexClause uses **teal** (teal-400 → teal-700) as the brand color. Tokens are in `src/index.css` under `:root { --brand-* }` and consumed via Tailwind's `brand-*` utility classes.

## Recent changes

- **v0.3.0 — Coverage Priority pivot.** LexClause changes job from dollar allocation to coverage priority. New `coverage_priority` mode on the edge function takes a matter (with structured allegations) + N policies + state rule and returns a three-section opinion: Trigger (which policies are triggered under the state's duty-to-defend test) / Priority (rank among triggered policies based on Other Insurance + state rule) / Exhaustion (vertical|horizontal|mixed) plus a 2-3 paragraph narrative. Validate-and-retry loop with new structural invariants. Migration 011 adds the schema. Old `allocate` mode preserved for backward compat. Hand-crafted test fixtures for NY/TX/CA in `docs/coverage_priority/`. Multi-state comparison validated end-to-end against asbestos long-tail scenario. (mig 011 + COVERAGE_PRIORITY_SYSTEM in `analyze-policy/index.ts`)
- **Matter intake from PDFs** — Drop an FNOL / ROR / complaint / claim summary, Claude extracts loss facts, dates, damages, venue, and named carriers. Frontend matches mentioned carriers against the existing policy library and offers to auto-attach. (mig 009 + MatterIntake.jsx)
- **Multi-state comparison engine** — Run the same matter under multiple governing states in parallel; Comparison.jsx shows a unified per-carrier table across states with divergence ranking. (mig 008 + Comparison.jsx)
- **Tower-aware allocation** — Primary/umbrella/excess layering with attachment_points, SIRs, follows-form, vertical vs horizontal exhaustion. (mig 002 + ALLOCATE_SYSTEM prompt)
- **Targeted-tender hard constraint** — Structured `lc_matters.targeted_carriers uuid[]`. The validator (deterministic, not LLM judgment) zeroes out any non-targeted carrier under IL/Kajima rules. (mig 006)
- **Validate-and-retry loop** — Edge function checks Claude's output against arithmetic invariants (sum equals exposure within $1, allocated_amount ≤ policy limit, share_pct + SIR fraction = 1.0); on failure feeds errors back and retries up to 3x. Surface as `validation_status` banner on Analysis.jsx. (mig 003)
- **Memo export (.docx + .pdf)** — `generateCoverageMemo.js` builds a coverage opinion memo from the analysis with carrier breakdown, tower explanation, and methodology. Export menu on Analysis.jsx.
- **Vetted citation catalog** — `lc_state_law_rules.citations` seeded with state-supreme-court controlling decisions; ALLOCATE_SYSTEM prompt pins Claude to those citations and forbids fabrication. (mig 004 + 005 + 007 + 010)
- **Background processing + polling** — `EdgeRuntime.waitUntil` lets the function return an `analysisId` immediately; frontend polls `lc_analyses.status` until complete or failed.
- v0.2.0: Decoupled from LexAlloc — own `lc_organizations` + `lc_profiles` + signup trigger; landing page, login footer, sidebar link, and settings hint scrubbed of LexAlloc references.
- v0.1.0: Scaffolded full app (frontend, Supabase migration, Edge Function, state-law catalog).
