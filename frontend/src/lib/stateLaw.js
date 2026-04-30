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
    notes: 'Continuous trigger. All-sums with right of contribution. Vertical exhaustion permitted (Montrose II, 2020 Cal. Sup. Ct.).',
    citations: [
      'Montrose Chem. Corp. v. Admiral Ins. (Montrose I), 10 Cal.4th 645 (1995)',
      'Montrose Chem. Corp. v. Superior Court (Montrose II), 9 Cal.5th 215 (2020)',
      "Fireman's Fund Ins. Co. v. Maryland Casualty Co., 65 Cal.App.4th 1279 (1998)",
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  NJ: {
    name: 'New Jersey',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Owens-Illinois pro-rata-by-time-and-limits. Continuous trigger. Carter-Wallace allocation in long-tail toxic-tort.',
    citations: [
      'Owens-Illinois, Inc. v. United Ins. Co., 138 N.J. 437 (1994)',
      'Carter-Wallace, Inc. v. Admiral Ins. Co., 154 N.J. 312 (1998)',
      'Spaulding Composites Co. v. Aetna Cas. & Sur. Co., 176 N.J. 25 (2003)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  NY: {
    name: 'New York',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Pro-rata-by-time-on-risk. Strict horizontal exhaustion (Viking Pump narrow exception for "non-cumulation" policies).',
    citations: [
      'Consol. Edison Co. of N.Y. v. Allstate Ins. Co., 98 N.Y.2d 208 (2002)',
      'In re Viking Pump, Inc., 27 N.Y.3d 244 (2016)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  IL: {
    name: 'Illinois',
    defaultMethod: ALLOCATION_METHOD.TARGETED_TENDER,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Targeted-tender / selective-tender state — insured may pick its carrier. Equal shares among targeted carriers.',
    citations: [
      'John Burns Constr. Co. v. Indiana Ins. Co., 189 Ill.2d 570 (2000)',
      'Kajima Constr. Servs., Inc. v. St. Paul Fire & Marine Ins. Co., 227 Ill.2d 102 (2007)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: true,
  },
  MA: {
    name: 'Massachusetts',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-years-of-coverage default.',
    citations: [
      'Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  PA: {
    name: 'Pennsylvania',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.MANIFESTATION,
    notes: 'Generally first-manifestation trigger; pro-rata where multiple periods triggered.',
    citations: [
      'Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)',
      "Pa. Nat'l Mut. Cas. Ins. Co. v. St. John, 106 A.3d 1 (Pa. 2014)",
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  TX: {
    name: 'Texas',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_BY_LIMITS,
    trigger: TRIGGER_THEORY.ACTUAL_INJURY,
    notes: 'Eight-corners and actual-injury rule. Pro-rata-by-limits where multiple policies triggered.',
    citations: [
      "Don's Bldg. Supply, Inc. v. OneBeacon Ins. Co., 267 S.W.3d 20 (Tex. 2008)",
      'Lennar Corp. v. Markel Am. Ins. Co., 413 S.W.3d 750 (Tex. 2013)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  FL: {
    name: 'Florida',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Trigger varies by claim type; pro-rata predominates in long-tail.',
    citations: [
      'Trizec Props., Inc. v. Biltmore Constr. Co., 767 F.2d 810 (11th Cir. 1985)',
      "Carrousel Concessions, Inc. v. Fla. Ins. Guar. Ass'n, 483 So. 2d 513 (Fla. Dist. Ct. App. 1986)",
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  WA: {
    name: 'Washington',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums with insured choice of any triggered policy.',
    citations: [
      "American Nat'l Fire Ins. Co. v. B&L Trucking & Constr. Co., 134 Wn.2d 413 (1998)",
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  OH: {
    name: 'Ohio',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums under Goodyear; insured may pick any triggered carrier.',
    citations: [
      'Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St. 3d 512 (2002)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },

  // ── TIER 2 — added migration 005 ──────────────────────────────────────────
  CT: {
    name: 'Connecticut',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail occurrences; continuous trigger generally applies.',
    citations: [
      'Sec. Ins. Co. of Hartford v. Lumbermens Mut. Cas. Co., 264 Conn. 688 (2003)',
      'R.T. Vanderbilt Co. v. Hartford Accident & Indem. Co., 333 Conn. 343 (2019)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  CO: {
    name: 'Colorado',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for environmental and other long-tail losses (Wallis).',
    citations: [
      'Public Service Co. of Colorado v. Wallis & Companies, 986 P.2d 924 (Colo. 1999)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  MN: {
    name: 'Minnesota',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.ACTUAL_INJURY,
    notes: 'Joint-and-several / all-sums under Silicone Implant; insured may target one triggered policy.',
    citations: [
      'In re Silicone Implant Ins. Coverage Litig., 667 N.W.2d 405 (Minn. 2003)',
      'Northern States Power Co. v. Fidelity & Cas. Co. of N.Y., 523 N.W.2d 657 (Minn. 1994)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  IN: {
    name: 'Indiana',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums under Dana Corp.; insured may pick any triggered policy with rights of contribution.',
    citations: [
      'Allstate Ins. Co. v. Dana Corp., 759 N.E.2d 1049 (Ind. 2001)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  WI: {
    name: 'Wisconsin',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS_WITH_REALLOC,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'All-sums with subsequent reallocation among co-insurers (Plastics Engineering).',
    citations: [
      "Plastics Eng'g Co. v. Liberty Mut. Ins. Co., 759 N.W.2d 613 (Wis. 2009)",
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  MO: {
    name: 'Missouri',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Joint-and-several / all-sums for long-tail environmental claims under Doe Run.',
    citations: [
      'Doe Run Resources Corp. v. American Guar. & Liab. Ins., 531 S.W.3d 508 (Mo. 2017)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  DE: {
    name: 'Delaware',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for environmental long-tail (Hercules).',
    citations: [
      'Hercules Inc. v. AIU Ins. Co., 784 A.2d 481 (Del. 2001)',
      'In re Viking Pump Inc., 148 A.3d 633 (Del. 2016)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  NC: {
    name: 'North Carolina',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Pro-rata-by-time on injury-in-fact for long-tail damage.',
    citations: [
      'Gaston County Dyeing Mach. Co. v. Northfield Ins. Co., 351 N.C. 293 (2000)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  GA: {
    name: 'Georgia',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Continuous-trigger / pro-rata for environmental and progressive-damage occurrences.',
    citations: [
      'Continental Cas. Co. v. H.S.I. Fin. Servs., 266 Ga. 260 (1996)',
      'HDI-Gerling America Ins. Co. v. Morrison Homes, Inc., 701 F.3d 662 (11th Cir. 2012)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  OR: {
    name: 'Oregon',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time mandated by ORS 465.480 for environmental claims; common law follows similar approach for other long-tail losses.',
    citations: [
      'ORS 465.480 (Oregon Environmental Cleanup Assistance Act)',
      'Lamb-Weston, Inc. v. Or. Auto. Ins. Co., 219 Or. 110 (1959)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },

  // ── TIER 2 round 2 — added migration 007 ──────────────────────────────────
  MD: {
    name: 'Maryland',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail. Continuous trigger under Lloyd E. Mitchell. Owens-Illinois-style allocation.',
    citations: [
      'Lloyd E. Mitchell, Inc. v. Maryland Casualty Co., 324 Md. 44 (1991)',
      'Mayor & City Council of Baltimore v. Utica Mut. Ins. Co., 145 Md. App. 256 (2002)',
      "Riley v. United Servs. Auto. Ass'n, 161 Md. App. 573 (2005)",
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  MI: {
    name: 'Michigan',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail environmental claims. Continuous trigger under Gelman Sciences. Note: Michigan coverage law has shifted multiple times — verify current authority on any specific issue.',
    citations: [
      'Gelman Sciences, Inc. v. Fidelity & Cas. Co. of N.Y., 456 Mich. 305 (1998)',
      'Arco Indus. Corp. v. Am. Motorists Ins. Co., 448 Mich. 395 (1995)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  VA: {
    name: 'Virginia',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.MANIFESTATION,
    notes: 'Manifestation trigger predominates for property-damage claims. Pro-rata where multiple periods are implicated. Virginia has comparatively limited coverage-allocation case law — verify before relying.',
    citations: [
      'Reisen v. Aetna Life & Cas. Co., 225 Va. 327 (1983)',
      'Morrow Corp. v. Harleysville Mut. Ins. Co., 101 F. Supp. 2d 422 (E.D. Va. 2000)',
      'Phila. Indem. Ins. Co. v. Coleman, 372 F.3d 207 (4th Cir. 2004)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },

  // ── TIER 3 — added migration 010 ──────────────────────────────────────────
  NH: {
    name: 'New Hampshire',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Continuous trigger and pro-rata-by-time-on-risk for long-tail under EnergyNorth.',
    citations: [
      'EnergyNorth Natural Gas, Inc. v. Continental Ins. Co., 146 N.H. 156 (2001)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  VT: {
    name: 'Vermont',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail under Towns v. Northern Security.',
    citations: [
      'Towns v. Northern Sec. Ins. Co., 184 Vt. 322 (2008)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  RI: {
    name: 'Rhode Island',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk under Truk-Away.',
    citations: [
      'Truk-Away of R.I., Inc. v. Aetna Cas. & Sur. Co., 723 A.2d 309 (R.I. 1999)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  HI: {
    name: 'Hawaii',
    defaultMethod: ALLOCATION_METHOD.ALL_SUMS,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Joint-and-several / all-sums approach under Sentinel; insured may target a triggered carrier.',
    citations: [
      'Sentinel Ins. Co. v. First Ins. Co. of Hawaii, 76 Haw. 277 (1994)',
    ],
    horizontalExhaustion: false,
    targetedTenderAllowed: false,
  },
  ME: {
    name: 'Maine',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Continuous trigger for progressive damage; pro-rata across triggered periods (Coakley).',
    citations: [
      'Coakley v. Maine Bonding & Cas. Co., 618 A.2d 777 (Me. 1992)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  LA: {
    name: 'Louisiana',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Civil-law jurisdiction. Pro-rata-by-time on continuous-injury asbestos / long-tail under Rando.',
    citations: [
      'Rando v. Anco Insulations Inc., 2008-1163 (La. 5/22/09), 16 So. 3d 1065',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  TN: {
    name: 'Tennessee',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail damage under Standard Fire / Chester O\'Donley line.',
    citations: [
      "Standard Fire Ins. Co. v. Chester O'Donley & Assocs., 972 S.W.2d 1 (Tenn. Ct. App. 1998)",
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  SC: {
    name: 'South Carolina',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Modified ratable / time-on-risk allocation under Crossmann; statute (S.C. Code § 38-61-70) codifies time-on-risk for progressive losses.',
    citations: [
      'Crossmann Communities of N.C., Inc. v. Harleysville Mut. Ins. Co., 395 S.C. 40 (2011)',
      'S.C. Code Ann. § 38-61-70 (time-on-risk allocation for progressive damage)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  IA: {
    name: 'Iowa',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.INJURY_IN_FACT,
    notes: 'Pro-rata-by-time-on-risk on injury-in-fact trigger for long-tail.',
    citations: [
      'Pottawattamie County v. Federated Rural Elec. Ins. Co., 612 N.W.2d 783 (Iowa 2000)',
    ],
    horizontalExhaustion: true,
    targetedTenderAllowed: false,
  },
  KY: {
    name: 'Kentucky',
    defaultMethod: ALLOCATION_METHOD.PRO_RATA_TIME_ON_RISK,
    trigger: TRIGGER_THEORY.CONTINUOUS,
    notes: 'Pro-rata-by-time-on-risk for long-tail damage under Aetna v. Commonwealth.',
    citations: [
      'Aetna Cas. & Sur. Co. v. Commonwealth, 179 S.W.3d 830 (Ky. 2005)',
    ],
    horizontalExhaustion: true,
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
