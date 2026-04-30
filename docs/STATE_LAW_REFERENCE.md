# State-Law Reference (working catalog)

> Plain-language summary of how each catalogued state allocates long-tail / multi-policy losses by default. **Not legal advice.** Always confirm current law before relying on this for a real matter — coverage law evolves.

The same data lives, in machine-readable form, in `frontend/src/lib/stateLaw.js` and the Postgres table `lc_state_law_rules`. Keep all three in sync when you update a rule.

### Tier 1 — Most-litigated coverage states

| State | Default method | Trigger | Horizontal exhaustion? | Targeted tender? | Anchor citations |
|-------|----------------|---------|------------------------|------------------|------------------|
| CA    | All-sums | Continuous | No (vertical OK) | No | *Montrose I* (1995); *Montrose II* (2020) |
| NJ    | Pro-rata by time **and** limits | Continuous | Yes | No | *Owens-Illinois* (1994); *Carter-Wallace* (1998) |
| NY    | Pro-rata by time on risk | Injury-in-fact | Yes (strict; *Viking Pump* narrow exception) | No | *Consol. Edison* (2002); *Viking Pump* (2016) |
| IL    | Targeted tender (equal shares among targets) | Continuous | No | **Yes** | *John Burns* (2000); *Kajima* (2007) |
| MA    | Pro-rata by years | Continuous | Yes | No | *Boston Gas* (2009) |
| PA    | Pro-rata across triggered periods | First manifestation (typical) | Yes | No | *Koppers* (1996); *St. John* (2014) |
| TX    | Pro-rata by limits | Actual injury | No (eight-corners) | No | *Don's Building Supply* (2008); *Lennar* (2013) |
| FL    | Pro-rata by time | Injury-in-fact (varies) | Yes | No | *Trizec Props.* (1985) |
| WA    | All-sums | Continuous | No | No | *B&L Trucking* (1998) |
| OH    | All-sums | Continuous | No | No | *Goodyear v. Aetna* (2002) |

### Tier 2 — Established rule, less litigated

| State | Default method | Trigger | Horizontal exhaustion? | Anchor citations |
|-------|----------------|---------|------------------------|------------------|
| CT    | Pro-rata by time | Continuous | Yes | *Sec. Ins. Co. of Hartford v. Lumbermens* (2003); *R.T. Vanderbilt* (2019) |
| CO    | Pro-rata by time | Continuous | Yes | *Public Service Co. of Colorado v. Wallis* (1999) |
| MN    | All-sums | Actual injury | No | *Silicone Implant Litig.* (2003); *Northern States Power* (1994) |
| IN    | All-sums | Continuous | No | *Allstate v. Dana Corp.* (2001) |
| WI    | All-sums w/ reallocation | Continuous | No | *Plastics Eng'g v. Liberty Mut.* (2009) |
| MO    | All-sums | Continuous | No | *Doe Run v. American Guarantee* (2017) |
| DE    | Pro-rata by time | Continuous | Yes | *Hercules v. AIU* (2001); *Viking Pump (Del.)* (2016) |
| NC    | Pro-rata by time | Injury-in-fact | Yes | *Gaston County Dyeing v. Northfield* (2000) |
| GA    | Pro-rata by time | Continuous | Yes | *Continental Cas. v. H.S.I. Fin.* (1996); *HDI-Gerling v. Morrison Homes* (2012) |
| OR    | Pro-rata by time | Continuous | Yes | ORS 465.480; *Lamb-Weston v. Or. Auto. Ins.* (1959) |

## How to read this table

- **Default method** — what the state applies if the policy is silent or ambiguous. Always pre-empted by enforceable, unambiguous policy language to the contrary.
- **Trigger** — when a policy year is "on the risk" for an alleged injury. Long-tail losses (environmental, asbestos, construction defect) implicate every policy in force during the trigger period.
- **Horizontal exhaustion** — must every primary across every year be exhausted before any excess can be reached?
- **Targeted tender** — may the insured select which carrier(s) bear the loss?

## All-sums vs. pro-rata in plain English

**All-sums:** the insured picks any one triggered carrier and demands the whole loss (up to limits). That carrier pays, then chases its co-insurers for contribution. Pro-insured.

**Pro-rata-by-time:** each triggered policy pays a share of the loss proportional to how long it was in force during the injury period. Pro-insurer (especially in long-tail).

**Pro-rata-by-limits:** each triggered policy pays a share proportional to its limit ÷ total triggered limits.

**Targeted tender (IL):** the insured names one or more carriers and they pay; the rest are off the hook unless brought in. Some other states permit a similar "selective tender" with limits.

## Choice-of-law starting points

Most states use one of:

1. **Restatement (Second) of Conflict of Laws § 188 / § 193** — most-significant-relationship test. Considers (a) place of contracting, (b) place of negotiation, (c) place of performance, (d) location of the subject matter, (e) domicile/residence of the parties.
2. **Lex loci contractus** — the state where the policy was issued / delivered controls.
3. **Insured's principal place of business** — for nationwide programs.

The matter screen lets the user enter all candidates; the analyzer runs once per chosen controlling state.

## States not yet in the catalog

20 states are seeded above. The remaining ~30 (AL, AK, AZ, AR, DC, HI, ID, IA, KS, KY, LA, ME, MD, MI, MS, MT, NE, NV, NH, NM, ND, OK, RI, SC, SD, TN, UT, VT, VA, WV, WY, et al.) return `UNDETERMINED` from the analyzer. When a matter forces the issue, add the rule to `stateLaw.js`, `lc_state_law_rules`, and this table.

Michigan, Virginia, and Maryland are notable omissions — they have well-established rules but the law has shifted enough that current authority should be verified before seeding (e.g., MI's path through *Arco Industries* and its progeny, VA's narrow manifestation-trigger rule, MD's pro-rata-by-time line). Treat them as next in the queue.

## Source-of-truth discipline

When you update a rule:

1. Edit `frontend/src/lib/stateLaw.js`.
2. Edit `supabase/migrations/001_lexclause_init.sql` seed (or write a follow-up migration if 001 is already run).
3. Edit this file.

If those three drift, the analyzer will give different answers depending on which path it takes.
