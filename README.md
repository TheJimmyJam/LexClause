# LexClause

**Coverage allocation for multi-policy, multi-state matters.**

LexClause analyzes insurance policies and decides how multiple carriers should share a single loss given the policy language, the trigger of coverage, and the controlling state law. Built for coverage counsel, claims professionals, and risk managers.

## What it does

- **Policy ingestion** — Drop in a stack of CGL, umbrella, and excess PDFs. Claude extracts limits, retentions, other-insurance language, allocation methodology clauses, exclusions, and endorsements into structured data.
- **Trigger & damage analysis** — When did the injury occur? Continuous trigger, manifestation, exposure, injury-in-fact? LexClause maps facts to coverage triggers.
- **Sharing-method recognition** — Pro-rata-by-time-on-risk, pro-rata-by-limits, all-sums, equal shares, vertical exhaustion, horizontal exhaustion. LexClause reads each policy's other-insurance clause and reconciles conflicts.
- **State-law layer** — Coverage law varies dramatically by state (NY's pro-rata vs. CA/NJ's all-sums, Carter-Wallace, targeted tender, anti-stacking). LexClause applies the law of the state governing the policies and the law of the state where the matter is venued.
- **Multi-jurisdictional matters** — Loss in TX, policies issued in NY, additional insured under a CA policy: LexClause surfaces the choice-of-law question and runs each candidate analysis.

## Stack

React + Vite + Tailwind frontend. Supabase (Postgres + Auth + RLS + Edge Functions) backend. Auto-deploys from `main` to Netlify.

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
├── supabase/
│   ├── migrations/      ← pa_ tables, RLS, signup trigger, state-law seed
│   └── functions/       ← analyze-policy edge function
├── docs/                ← ANALYSIS_SPEC.md, STATE_LAW_REFERENCE.md
├── netlify.toml         ← base = "frontend"
└── CLAUDE.md            ← session context for Claude
```

## Status

Scaffolding stage. See `docs/ANALYSIS_SPEC.md` for the analysis-engine design.
