-- ============================================================================
-- Migration 014 — seed tier-3 states for coverage_priority
--
-- Adds DE, MD, NC, LA, SC, NH, RI, TN, IA, KY. Each has at least one
-- controlling state-supreme-court duty-to-defend or trigger decision. For
-- states where there is no clear state-supreme-court priority or exhaustion
-- decision, the citation array is left empty and the narrative says so plainly
-- — the engine will write the doctrine in general terms with the
-- "no citation in catalog for this point" phrasing rather than fabricate.
--
-- VT, HI, and ME are intentionally NOT seeded. Their commercial-coverage law
-- is too thin to support honest citations. They stay producing
-- "no citation in catalog for this point" output until a real matter forces
-- the research.
-- ============================================================================

-- ── Delaware ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Delaware applies a continuous-trigger doctrine for long-tail bodily injury and progressive property damage (Hercules). Every policy in effect from initial exposure through manifestation is triggered. The duty to defend arises when the underlying complaint alleges any claim potentially within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Hercules, Inc. v. AIU Ins. Co., 784 A.2d 481 (Del. 2001)",
    "Continental Cas. Co. v. Diamond State Ins. Co., 472 F.3d 187 (3d Cir. 2007)"
  ]$$::jsonb,
  priority_rule = $$Delaware gives effect to clear policy language and follows the majority approach to Other Insurance disputes: where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, typically by limits. For long-tail claims, Delaware applies pro-rata-by-time-on-risk among triggered primaries.$$,
  priority_citations = $$[
    "Hercules, Inc. v. AIU Ins. Co., 784 A.2d 481 (Del. 2001)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Hercules, Inc. v. AIU Ins. Co., 784 A.2d 481 (Del. 2001)"
  ]$$::jsonb
where state_code = 'DE';

-- ── Maryland ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Maryland applies a continuous-trigger doctrine for long-tail bodily injury (Lloyd E. Mitchell, asbestos). Every policy in effect during the period of exposure or injury is triggered. The duty to defend turns on whether the allegations of the underlying complaint potentially fall within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Lloyd E. Mitchell, Inc. v. Maryland Cas. Co., 324 Md. 44 (1991)",
    "Litz v. State Farm Fire & Cas. Co., 346 Md. 217 (1997)",
    "Sheets v. Brethren Mut. Ins. Co., 342 Md. 634 (1996)"
  ]$$::jsonb,
  priority_rule = $$Maryland gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, Maryland follows the majority rule: the clauses are mutually repugnant and the policies share pro-rata. For long-tail allocation, Maryland applies pro-rata-by-time-on-risk among triggered primaries.$$,
  priority_citations = $$[
    "Lloyd E. Mitchell, Inc. v. Maryland Cas. Co., 324 Md. 44 (1991)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Lloyd E. Mitchell, Inc. v. Maryland Cas. Co., 324 Md. 44 (1991)"
  ]$$::jsonb
where state_code = 'MD';

-- ── North Carolina ──────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$North Carolina applies a duty-to-defend test driven by the allegations of the underlying complaint compared to the policy. If any allegation is potentially within coverage, the duty attaches. North Carolina has not squarely adopted a continuous-trigger doctrine at the state-supreme-court level, but trial and appellate courts have applied injury-in-fact and exposure analyses to long-tail claims.$$,
  trigger_citations = $$[
    "Waste Management of Carolinas, Inc. v. Peerless Ins. Co., 315 N.C. 688 (1986)",
    "N.C. Farm Bureau Mut. Ins. Co. v. Cully's Grill & Bar, 366 N.C. 505 (2013)"
  ]$$::jsonb,
  priority_rule = $$North Carolina gives effect to clear policy language and follows the majority approach. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are typically deemed mutually repugnant and shared pro-rata. No controlling state-supreme-court decision squarely addresses Other Insurance priority allocation in the long-tail context.$$,
  priority_citations = $$[]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'NC';

-- ── Louisiana ───────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Louisiana applies an exposure-based continuous-trigger doctrine for long-tail bodily injury (Cole v. Celotex, asbestos). Every policy in effect during the period of exposure to harm is triggered. The duty to defend arises whenever the underlying allegations are 'reasonably possible' within coverage (Yount v. Maisano).$$,
  trigger_citations = $$[
    "Cole v. Celotex Corp., 599 So.2d 1058 (La. 1992)",
    "Yount v. Maisano, 627 So.2d 148 (La. 1993)"
  ]$$::jsonb,
  priority_rule = $$Louisiana gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, consistent with the majority national approach.$$,
  priority_citations = $$[
    "Cole v. Celotex Corp., 599 So.2d 1058 (La. 1992)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Cole v. Celotex Corp., 599 So.2d 1058 (La. 1992)"
  ]$$::jsonb
where state_code = 'LA';

-- ── South Carolina ──────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$South Carolina applies a continuous-trigger / injury-in-fact doctrine for long-tail and progressive damage claims (Joe Harden Builders, defective construction). The duty to defend arises whenever the underlying complaint alleges any claim potentially within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Joe Harden Builders, Inc. v. Aetna Cas. & Sur. Co., 326 S.C. 231 (1997)",
    "USAA Prop. & Cas. Ins. Co. v. Clegg, 377 S.C. 643 (2008)"
  ]$$::jsonb,
  priority_rule = $$South Carolina gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, consistent with the majority approach. No controlling state-supreme-court decision squarely addresses long-tail allocation methodology.$$,
  priority_citations = $$[
    "Joe Harden Builders, Inc. v. Aetna Cas. & Sur. Co., 326 S.C. 231 (1997)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'SC';

-- ── New Hampshire ───────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$New Hampshire applies a continuous-trigger doctrine for long-tail environmental contamination (EnergyNorth). Every policy in effect during the period of property damage is triggered. The duty to defend arises whenever any allegation potentially falls within coverage.$$,
  trigger_citations = $$[
    "EnergyNorth Natural Gas, Inc. v. Continental Ins. Co., 146 N.H. 156 (2001)"
  ]$$::jsonb,
  priority_rule = $$New Hampshire gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, consistent with the majority approach. For long-tail allocation, New Hampshire applies pro-rata-by-time-on-risk among triggered primaries (EnergyNorth).$$,
  priority_citations = $$[
    "EnergyNorth Natural Gas, Inc. v. Continental Ins. Co., 146 N.H. 156 (2001)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "EnergyNorth Natural Gas, Inc. v. Continental Ins. Co., 146 N.H. 156 (2001)"
  ]$$::jsonb
where state_code = 'NH';

-- ── Rhode Island ────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Rhode Island applies a continuous-trigger doctrine for long-tail environmental contamination (Textron). Every policy in effect during the period of property damage is triggered. The duty to defend turns on whether the allegations of the underlying complaint, taken as true, potentially fall within coverage.$$,
  trigger_citations = $$[
    "Textron, Inc. v. Aetna Cas. & Sur. Co., 638 A.2d 537 (R.I. 1994)",
    "Truk-Away of R.I., Inc. v. Aetna Cas. & Sur. Co., 723 A.2d 309 (R.I. 1999)"
  ]$$::jsonb,
  priority_rule = $$Rhode Island gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, consistent with the majority approach.$$,
  priority_citations = $$[
    "Textron, Inc. v. Aetna Cas. & Sur. Co., 638 A.2d 537 (R.I. 1994)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Textron, Inc. v. Aetna Cas. & Sur. Co., 638 A.2d 537 (R.I. 1994)"
  ]$$::jsonb
where state_code = 'RI';

-- ── Tennessee ───────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Tennessee applies a duty-to-defend potentiality standard: the duty arises if the underlying complaint alleges any claim potentially within coverage (Torpoco). Tennessee has not squarely adopted a continuous-trigger doctrine at the state-supreme-court level for long-tail bodily injury or environmental claims.$$,
  trigger_citations = $$[
    "St. Paul Fire & Marine Ins. Co. v. Torpoco, 879 S.W.2d 831 (Tenn. 1994)"
  ]$$::jsonb,
  priority_rule = $$Tennessee gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are typically deemed mutually repugnant and shared pro-rata, consistent with the majority national approach. No controlling state-supreme-court decision squarely addresses Other Insurance priority allocation.$$,
  priority_citations = $$[]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'TN';

-- ── Iowa ────────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Iowa applies a duty-to-defend potentiality standard: the duty arises whenever the underlying complaint alleges any claim potentially within coverage (First Newton; Hagen). Iowa has not squarely adopted a continuous-trigger doctrine at the state-supreme-court level for long-tail bodily injury claims.$$,
  trigger_citations = $$[
    "First Newton Nat'l Bank v. General Cas. Co. of Wis., 426 N.W.2d 618 (Iowa 1988)",
    "Hagen v. Texaco Refining & Marketing, Inc., 526 N.W.2d 531 (Iowa 1995)"
  ]$$::jsonb,
  priority_rule = $$Iowa gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are typically deemed mutually repugnant and shared pro-rata. No controlling state-supreme-court decision squarely addresses Other Insurance priority allocation.$$,
  priority_citations = $$[]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'IA';

-- ── Kentucky ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Kentucky applies a duty-to-defend potentiality standard: the duty arises whenever the underlying complaint alleges any claim potentially within coverage. Kentucky has not squarely adopted a continuous-trigger doctrine at the state-supreme-court level.$$,
  trigger_citations = $$[
    "James Graham Brown Found., Inc. v. St. Paul Fire & Marine Ins. Co., 814 S.W.2d 273 (Ky. 1991)",
    "Aetna Cas. & Sur. Co. v. Commonwealth, 179 S.W.3d 830 (Ky. 2005)"
  ]$$::jsonb,
  priority_rule = $$Kentucky gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are typically deemed mutually repugnant and shared pro-rata, consistent with the majority approach. No controlling state-supreme-court decision squarely addresses Other Insurance priority allocation.$$,
  priority_citations = $$[]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'KY';
