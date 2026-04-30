# LexClause — Claude Session Reference

Sister product to LexAlloc. Coverage-allocation analysis: how should multiple insurance policies share a single loss given the policy language, the trigger of coverage, and the controlling state law?

## ⚠️ Folder layout (no nested duplicate this time)

Unlike LexAlloc — which has a stale `/lexalloc/` subfolder in GitHub — LexClause lives at the repo root. **What I edit locally is what gets pushed.** Path translation is 1:1.

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
- **Backend**: Supabase — **shared with LexAlloc** (same project URL, same anon key, same auth, same la_profiles / la_organizations)
- **LexClause tables**: prefixed `pa_` (LexAlloc uses `la_`)
- **AI engine**: Edge Function `analyze-policy` calls Claude API. Frontend never touches the Anthropic key.
- **Deploy**: Netlify, auto-deploys from GitHub `main`
- **Repo**: `TheJimmyJam/LexClause`

## Routes

| Route                                               | File              | Purpose |
|-----------------------------------------------------|-------------------|---------|
| `/`                                                 | Landing.jsx       | Marketing landing |
| `/login`, `/register`, `/forgot-password`           | Login/Register/ForgotPassword | Auth (shares LexAlloc users) |
| `/dashboard`                                        | Dashboard.jsx     | Counts and quick actions |
| `/policies`                                         | Policies.jsx      | Policy library |
| `/policies/upload`                                  | PolicyUpload.jsx  | PDF dropzone → Edge Function extraction |
| `/policies/:policyId`                               | PolicyDetail.jsx  | Extracted fields, re-run extraction |
| `/matters`                                          | Matters.jsx       | List of coverage matters |
| `/matters/:matterId`                                | MatterDetail.jsx  | Loss facts, jurisdictions, attached policies, run analysis |
| `/matters/:matterId/analysis/:analysisId`           | Analysis.jsx      | Per-carrier shares + methodology memo |
| `/settings`                                         | Settings.jsx      | Profile + org info |

## Key files

- `src/lib/supabase.js`        — Supabase client (separate auth storageKey to avoid stomping LexAlloc's session)
- `src/lib/policyAnalysis.js`  — Frontend wrapper for the `analyze-policy` Edge Function
- `src/lib/stateLaw.js`        — State-law catalog (CA, NJ, NY, IL, MA, PA, TX, FL, WA, OH seeded)
- `src/hooks/useAuth.jsx`      — Reuses `la_profiles` / `la_organizations`
- `supabase/migrations/001_lexclause_init.sql` — pa_ tables, RLS, storage bucket, state-law seed
- `supabase/functions/analyze-policy/index.ts` — Two modes: `extract_terms`, `allocate`

## Database — pa_ tables

| Table                      | Purpose |
|----------------------------|---------|
| `pa_policies`              | Policy library: limits, retentions, other-insurance language, extraction status |
| `pa_policy_endorsements`   | Per-policy endorsements |
| `pa_policy_exclusions`     | Per-policy exclusions |
| `pa_matters`               | Coverage matters: loss facts, jurisdictions, governing state |
| `pa_matter_policies`       | Many-to-many: which policies are subject to a matter |
| `pa_analyses`              | One row per allocation run (status, methodology memo) |
| `pa_analysis_results`      | Per-policy share rows for an analysis |
| `pa_state_law_rules`       | Overrideable state-law catalog (seeded; mirrors `stateLaw.js`) |

RLS gating: every pa_ table is gated by `org_id = pa_user_org()` where `pa_user_org()` returns `la_profiles.org_id` for `auth.uid()`. LexClause auth uses the same profile row LexAlloc uses.

Storage bucket: `pa-policies`, files at `<org_id>/<timestamp>-<filename>.pdf`.

## GitHub Push Script Template

```python
import urllib.request, urllib.error, json, base64

PAT   = 'ghp_xxxx...'  # see Jimmy's 1Password / desktop/projects/.credentials
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

# Local → GitHub: paths are identical (no `lexclause/` prefix to strip)
LOCAL_BASE = '/sessions/<session>/mnt/LexClause'

push(
    'frontend/src/pages/Landing.jsx',
    f'{LOCAL_BASE}/frontend/src/pages/Landing.jsx',
    'feat: landing copy tweak'
)
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
- `VITE_SUPABASE_URL` — same value as LexAlloc
- `VITE_SUPABASE_ANON_KEY` — same value as LexAlloc

**Supabase Edge Function `analyze-policy` secrets**
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (optional, default `claude-sonnet-4-6`)
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are auto-injected.

## Pending / known gaps

- PDF text extraction is stubbed — `pa_policies.source_text` must be populated before `extract_terms` runs. Wire in a PDF parser (pdf-parse, or Anthropic's PDF input API) before going live.
- State-law catalog covers 10 states. Round it out as matters demand — keep `stateLaw.js` and `pa_state_law_rules` in sync.
- Memo export button is wired up visually but the export function isn't built yet.
- No cross-link to LexAlloc matters in the UI (the `pa_matters.lexalloc_matter_id` column is in place).

## Brand color

LexClause uses **teal** (teal-400 → teal-700) as the brand color to differentiate from LexAlloc's indigo. Tokens are in `src/index.css` under `:root { --brand-* }` and consumed via Tailwind's `brand-*` utility classes.

## Recent changes

- v0.1.0: Scaffolded full app (frontend, Supabase migration 001, Edge Function `analyze-policy`, state-law catalog, CLAUDE.md). Ready for first push to GitHub.
