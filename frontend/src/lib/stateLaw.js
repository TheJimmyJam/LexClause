/**
 * State-law catalog for coverage allocation and policy interpretation.
 *
 * This is the deterministic rules layer. Claude does the language extraction;
 * this module decides which rules apply. It MUST be the source of truth — any
 * legal updates land here, not inside an LLM prompt.
 *
 * Citations are NON-EXHAUSTIVE pointers. Always confirm current state law
 * before relying on output for a real matter — this catalog is a starting
 * point, not legal advice.
 */

export const ALLOCATION_METHOD = {
  PRO_RATA_TIME_ON_RISK: 'pro_rata_time_on_risk',
  PRO_RATA_BY_LIMITS:    'pro_rata_by_limits',
  ALL_SUMS:              'all_sums',
  ALL_SUMS_WITH_REALLOC: 'all_sums_with_reallocation',
  EQUAL_SHARES:          'equal_shares',
  TARGETED_TENDER:       'targeted_tender',
  UNDETERMINED:          'undetermined',
}

export const TRIGGER_THEORY = {
  EXPOSURE:        'exposure',
  MANIFESTATION:   'manifestation',
  CONTINUOUS:      'continuous_trigger',
  INJURY_IN_FACT:  'injury_in_fact',
  ACTUAL_INJURY:   'actual_injury',
  UNDETERMINED:    'undetermined',
}

/**
 * Per-state defaults for long-tail coverage allocation.
 * Real disputes will turn on policy language and the specific facts; these
 * are the "if the policy is silent or ambiguous, what does the state default
 * to" answers.
 */
export const STATE_RULES = {
  // ── ALL-SUMS / JOINT-AND-SEVERAL JURISDICTIONS ───────────────────────────
  CA: {
    name: 'California',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Continuous trigger. All-sums with right of contribution. Montrose I & II.',
    citations: ['Montrose Chem. Corp. v. Admiral Ins., 10 Cal.4th 645 (1995)', 'Montrose II, 9 Cal.5th 215 (2020)'],
    horizontalExhaustion: false, // vertical exhaustion permitted
    targetedTenderAllowed: false,
  },
  NJ: {
    name: 'New Jersey',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Owens-Illinois pro-rata-by-time-and-limits. Continuous trigger.',
    citations: ['Owens-Illinois v. United Ins., 138 N.J. 437 (1994)', 'Carter-Wallace v. Admiral Ins., 154 N.J. 312 (1998)'],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  NY: {
    name: 'New York',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Pro-rata-by-time-on-risk. Strict horizontal exhaustion (Viking Pump for "non-cumulation" policies — narrow exception).',
    citations: ['Consolidated Edison v. Allstate, 98 N.Y.2d 208 (2002)', 'In re Viking Pump, 27 N.Y.3d 244 (2016)'],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  IL: {
    name: 'Illinois',
    defaultMethod: ALLOCATION_METHOD.TARGETED_TENDER,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Targeted-tender / selective-tender state — insured may pick its carrier. Equal shares among targeted carriers.',
    citations: ['John Burns Constr. Co. v. Indiana Ins., 189 Ill.2d 570 (2000)', 'Kajima Constr. Servs. v. St. Paul Fire, 227 Ill.2d 102 (2007)'],
    horizontalExhaustion: false,
    targetedTenderAllowed: true,
  },
  MA: {
    name: 'Massachusetts',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-years-of-coverage default.',
    citations: ['Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)'],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  PA: {
    name: 'Pennsylvania',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.MANIFESTATION,
    notes: 'Generally first-manifestation trigger; pro-rata where multiple periods triggered.',
    citations: ['Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)', 'Pa. Nat\'l Mut. Cas. Ins. Co. v. St. John, 106 A.3d 1 (Pa. 2014)'],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  TX: {
    name: 'Texas',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_BY_LIMITS,
    trigger: TRIGGER_THEORY.ACTUAL_INJURY,
    notes: 'Eight-corners and actual-injury rule. Pro-rata-by-limits where contract triggers multiple policies.',
    citations: ['Don\'s Bldg. Supply v. OneBeacon, 267 S.W.3d 20 (Tex. 2008)', 'Lennar Corp. v. Markel Am. Ins., 413 S.W.3d 750 (Tex. 2013)'],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  FL: {
    name: 'Florida',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Trigger varies by claim type; pro-rata predominates in long-tail.',
    citations: ['Trizec Props. v. Biltmore Const. Co., 767 F.2d 810 (11th Cir. 1985)'],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  WA: {
    name: 'Washington',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums with insured choice of any triggered policy.',
    citations: ['American Nat\'l Fire Ins. v. B&L Trucking, 134 Wn.2d 413 (1998)'],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  OH: {
    name: 'Ohio',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums under Goodyear; insured may pick any triggered carrier.',
    citations: ['Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St. 3d 512 (2002)'],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  // ── Stub the rest with UNDETERMINED so the analyzer at least labels the gap ──
}

/**
 * Choice-of-law preliminary check.
 * Returns the candidate jurisdictions whose law could govern.
 *
 * Most courts apply either (a) the law of the state where the policy was
 * issued / where the insured is domiciled, or (b) the most-significant-
 * relationship test (Restatement § 188 / 193). This is a screening tool —
 * the human user must choose the controlling law for the analysis.
 */
export function candidateJurisdictions({
  policyIssuedStates = [],   // array of state codes
  matterVenueState   = null, // state code where suit/loss is venued
  insuredHQState     = null, // state code of the insured's principal place of business
  lossLocationStates = [],   // states where the underlying injuries/damages occurred
}) {
  const candidates = new Set()
  policyIssuedStates.forEach(s => s && candidates.add(s))
  if (matterVenueState) candidates.add(matterVenueState)
  if (insuredHQState)   candidates.add(insuredHQState)
  lossLocationStates.forEach(s => s && candidates.add(s))
  return [...candidates].map(code => ({
    code,
    rule: STATE_RULES[code] || { name: code, defaultMethod: ALLOCATION_METHOD.UNDETERMINED, notes: 'Not yet catalogued.' },
  }))
}

export function getStateRule(code) {
  return STATE_RULES[code] || null
}
