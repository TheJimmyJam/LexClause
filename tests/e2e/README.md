# LexClause end-to-end test

Drives the full live pipeline against the deployed Supabase project + edge functions, asserts the engine produces the expected priority opinion for a synthetic Texas scenario.

The test scenario is a TX state-court complaint alleging property damage and bodily injury from a dropped steel beam at a construction site, plus two CGL policies — one with a silent Other Insurance clause (should rank **primary**) and one with a pure-excess Other Insurance clause (should rank **excess**) under *Mid-Continent v. Liberty Mutual*.

## Prerequisites

- Python 3.10+
- `pip install reportlab` (for PDF generation)
- A `.credentials` file with the LexClause Supabase keys. The test reads from `~/Desktop/Projects/.credentials` by default; override with `LEXCLAUSE_CREDS_PATH=/path/to/.credentials`.

Required keys in `.credentials`:

```
LEXCLAUSE_SUPABASE_URL=https://<ref>.supabase.co
LEXCLAUSE_SUPABASE_SERVICE_ROLE_KEY=<jwt>
LEXCLAUSE_SUPABASE_ANON_KEY=<jwt>
LEXCLAUSE_LOGIN_PRIMARY_EMAIL=<email of an existing LexClause user>
```

The test uses the service-role key, but it still needs an existing user's `org_id` to attach the test matter to (so RLS works correctly when you view it later in the UI).

## Run

```bash
# 1. Generate the synthetic PDFs (once; outputs to ./sample_pdfs/)
python3 gen_sample_pdfs.py

# 2. Run the full pipeline in one shot
python3 run_all.py
```

Or run the phases individually, useful when debugging a specific step:

```bash
python3 phase1_upload_and_classify.py    # ~30s — uploads, classifies, creates matter, extracts allegations
python3 phase2_extract_and_kickoff.py    # ~15-25s — extract_terms in parallel, kicks off coverage_priority
python3 phase3_poll_and_verify.py        # ~30-90s — polls until done, asserts the result
```

State carries between phases via `.state.json` (gitignored).

## What the test verifies

After the pipeline finishes, `phase3_poll_and_verify.py` asserts:

- Both CGLs are triggered (the steel-beam BI/PD has nothing to do with pollution, so CG 21 49 doesn't bar)
- Liberty Mutual is ranked **primary** (silent Other Insurance defaults to primary)
- Travelers is ranked **excess** (pure-excess Other Insurance gives effect)
- Exhaustion rule = **vertical** (Texas, per *Keck, Mahin & Cate*)
- The priority citation is one of the seeded TX cases (*Mid-Continent v. Liberty Mut.*, *Hardware Dealers*, or *Trinity Universal*)
- Narrative is non-empty
- Validator passed (`validation_status === 'valid'`)

Exits 0 if all checks pass, 1 if any fail, 2 if the engine itself errored.

## What the test does *not* test

- Authenticated user flow through the Analyzer UI (this runs with the service-role key and bypasses RLS / auth)
- The `email-opinion` edge function (build it as a separate scenario when needed)
- Multi-state comparison runs (the existing single-state path covers the engine; comparison is the same path × N)
- Failure / retry paths

## Cleaning up after a test run

The test creates rows in `lc_matters`, `lc_policies`, `lc_matter_policies`, `lc_analyses`, `lc_analysis_results`, plus storage objects in `lc-matter-docs` and `lc-policies` for the test org. They're harmless and accumulate over time. To clean:

```sql
delete from lc_matters where name like 'E2E Test —%';
-- The cascade on lc_matter_policies → lc_analyses → lc_analysis_results
-- handles the dependent rows. Storage objects are not auto-cleaned.
```
