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
│   ├── migrations/001_lexclause_init.sql
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
- **Backend**: Supabase — its own dedicated project (no shared backends)
- **Tables**: prefixed `lc_` (policy-allocation namespace; the prefix is internal — users never see it)
- **AI engine**: Edge Function `analyze-policy` calls Claude API. Frontend never touches the Anthropic key.
- **Deploy**: Netlify, auto-deploys from GitHub `main`
- **Repo**: `TheJimmyJam/LexClause`

## Routes

| Route                                               | File              | Purpose |
|-----------------------------------------------------|-------------------|---------|
| `/`                                                 | Landing.jsx       | Marketing landing |
| `/login`, `/register`, `/forgot-password`           | Login/Register/ForgotPassword | Auth |
| `/dashboard`                                        | Dashboard.jsx     | Counts and quick actions |
| `/policies`                                         | Policies.jsx      | Policy library |
| `/policies/upload`                                  | PolicyUpload.jsx  | PDF dropzone → Edge Function extraction |
| `/policies/:policyId`                               | PolicyDetail.jsx  | Extracted fields, re-run extraction |
| `/matters`                                          | Matters.jsx       | List of coverage matters |
| `/matters/:matterId`                                | MatterDetail.jsx  | Loss facts, jurisdictions, attached policies, run analysis |
| `/matters/:matterId/analysis/:analysisId`           | Analysis.jsx      | Per-carrier shares + methodology memo |
| `/settings`                                         | Settings.jsx      | Profile + org info |

## Key files

- `src/lib/supabase.js`        — Supabase client
- `src/lib/policyAnalysis.js`  — Frontend wrapper for the `analyze-policy` Edge Function
- `src/lib/stateLaw.js`        — State-law catalog (CA, NJ, NY, IL, MA, PA, TX, FL, WA, OH seeded)
- `src/hooks/useAuth.jsx`      — Reads from `lc_profiles` + `lc_organizations`
- `supabase/migrations/001_lexclause_init.sql` — All lc_ tables + RLS + signup trigger + state-law seed + storage bucket
- `supabase/functions/analyze-policy/index.ts` — Two modes: `extract_terms`, `allocate`

## Database — lc_ tables

| Table                      | Purpose |
|----------------------------|---------|
| `lc_organizations`         | Tenant — one per signed-up firm |
| `lc_profiles`              | One row per auth.users user; links to org_id |
| `lc_policies`              | Policy library: limits, retentions, other-insurance language, extraction status |
| `lc_policy_endorsements`   | Per-policy endorsements |
| `lc_policy_exclusions`     | Per-policy exclusions |
| `lc_matters`               | Coverage matters: loss facts, jurisdictions, governing state |
| `lc_matter_policies`       | Many-to-many: which policies are subject to a matter |
| `lc_analyses`              | One row per allocation run (status, methodology memo) |
| `lc_analysis_results`      | Per-policy share rows for an analysis |
| `lc_state_law_rules`       | Overrideable state-law catalog (seeded; mirrors `stateLaw.js`) |

RLS gating: every lc_ table is gated by `org_id = lc_user_org()`, where `lc_user_org()` returns `lc_profiles.org_id` for `auth.uid()`. Storage bucket `lc-policies`, files at `<org_id>/<timestamp>-<filename>.pdf`.

Signup flow: `Register.jsx` calls `supabase.auth.signUp()` with `org_name`, `first_name`, and `last_name` in `raw_user_meta_data`. The `handle_new_lexclause_user()` trigger on `auth.users` creates the `lc_organizations` row and the `lc_profiles` row in one shot, with the new user as `admin` of their fresh org.

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

## Pending / known gaps

- LexClause needs its own dedicated Supabase project. Spin one up and wire the env vars (don't reuse LexAlloc's project — that has the LA tables and would cross-contaminate).
- PDF text extraction is stubbed — `lc_policies.source_text` must be populated before `extract_terms` runs. Wire in a PDF parser (pdf-parse, or Anthropic's PDF input API) before going live.
- State-law catalog covers 10 states. Round it out as matters demand — keep `stateLaw.js` and `lc_state_law_rules` in sync.
- Memo export button is wired up visually but the export function isn't built yet.
- No citation verifier on the methodology memo — Claude can fabricate plausible-sounding cases. Before any external user touches output, plug in a vetted citation library or a Westlaw/Lexis check.

## Brand color

LexClause uses **teal** (teal-400 → teal-700) as the brand color. Tokens are in `src/index.css` under `:root { --brand-* }` and consumed via Tailwind's `brand-*` utility classes.

## Recent changes

- v0.2.0: Decoupled from LexAlloc — own lc_organizations + lc_profiles + signup trigger; landing page, login footer, sidebar link, and settings hint scrubbed of LexAlloc references; positioned as a standalone product.
- v0.1.0: Scaffolded full app (frontend, Supabase migration, Edge Function, state-law catalog).
