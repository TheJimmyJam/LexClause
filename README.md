# LexClause

**Policy allocation & coverage-share analysis** — sister app to [LexAlloc](https://github.com/TheJimmyJam/LexAlloc).

LexAlloc apportions invoices across parties and policy periods. LexClause analyzes the policies themselves: how should multiple carriers share a single loss given their policy language, the facts of the lawsuit, the trigger of coverage, and the governing state law?

## What it does

- **Policy ingestion** — Drop in a PDF policy (or stack of them). Claude extracts limits, retentions, other-insurance language, allocation methodology clauses, exclusions, and endorsements into structured data.
- **Trigger & damage analysis** — When did the injury occur? Continuous trigger, manifestation, exposure, injury-in-fact? Claude maps facts to coverage triggers.
- **Sharing-method recognition** — Pro-rata-by-time-on-risk, pro-rata-by-limits, all-sums, equal shares, vertical exhaustion, horizontal exhaustion. LexClause reads each policy's other-insurance clause and reconciles conflicts.
- **State-law layer** — Coverage law varies dramatically by state (NY's pro-rata vs. CA/NJ's all-sums, Carter-Wallace, targeted tender, anti-stacking). LexClause applies the law of the state governing the policies and the law of the state where the matter is venued.
- **Multi-jurisdictional matters** — Loss in TX, policies issued in NY, additional insured under a CA policy: LexClause surfaces the choice-of-law question and runs each candidate analysis.

## Stack

React + Vite + Tailwind frontend. Supabase (Postgres + Auth + RLS) backend, **shared with LexAlloc** — same login, same orgs. LexClause tables are prefixed `pa_` to sit alongside LexAlloc's `la_` tables. Auto-deploys from `main` to Netlify.

## Repo layout

```
LexClause/
├── frontend/            ← Netlify build base
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── hooks/
│   │   ├── lib/         ← supabase, policyAnalysis (Claude API), stateLaw
│   │   └── pages/
│   ├── package.json
│   └── ...
├── supabase/migrations/ ← pa_ tables, RLS, edge functions
├── docs/                ← ANALYSIS_SPEC.md, STATE_LAW_REFERENCE.md
├── netlify.toml         ← base = "frontend"
└── CLAUDE.md            ← session context for Claude
```

## Status

Scaffolding stage. See `docs/ANALYSIS_SPEC.md` for the analysis-engine design.
