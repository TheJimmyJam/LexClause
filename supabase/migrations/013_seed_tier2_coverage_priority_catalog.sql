-- ============================================================================
-- Migration 013 — seed tier-2 states for coverage_priority
--
-- Adds CT, MN, MO, GA, MI, VA, IN, WI, CO, OR to the production catalog.
-- All citations are real, public, state-supreme-court (or, where noted,
-- controlling federal circuit) decisions. The priority/exhaustion narratives
-- distill the controlling rule per state into prompt-ready text.
-- ============================================================================

-- ── Connecticut ─────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Connecticut applies a continuous-trigger doctrine for long-tail bodily injury and progressive property damage. Every policy in effect from initial exposure through manifestation is triggered. The duty to defend turns on whether the underlying complaint alleges any claim potentially within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "R.T. Vanderbilt Co. v. Hartford Accident & Indem. Co., 333 Conn. 343 (2019)",
    "Sec. Ins. Co. of Hartford v. Lumbermens Mut. Cas. Co., 264 Conn. 688 (2003)"
  ]$$::jsonb,
  priority_rule = $$Connecticut gives effect to clear policy language. When two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, typically by limits. For long-tail allocation, Connecticut applies pro-rata-by-time-on-risk among triggered primaries (R.T. Vanderbilt).$$,
  priority_citations = $$[
    "Sec. Ins. Co. of Hartford v. Lumbermens Mut. Cas. Co., 264 Conn. 688 (2003)",
    "R.T. Vanderbilt Co. v. Hartford Accident & Indem. Co., 333 Conn. 343 (2019)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "R.T. Vanderbilt Co. v. Hartford Accident & Indem. Co., 333 Conn. 343 (2019)"
  ]$$::jsonb
where state_code = 'CT';

-- ── Minnesota ───────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Minnesota applies an actual-injury / continuous-trigger doctrine for long-tail bodily injury and environmental contamination. Each policy in effect during the period of actual injury is triggered. The duty to defend arises if the complaint alleges any claim arguably within coverage.$$,
  trigger_citations = $$[
    "Northern States Power Co. v. Fid. & Cas. Co. of N.Y., 523 N.W.2d 657 (Minn. 1994)",
    "Domtar, Inc. v. Niagara Fire Ins. Co., 563 N.W.2d 724 (Minn. 1997)"
  ]$$::jsonb,
  priority_rule = $$Minnesota gives effect to clear Other Insurance language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and prorated. For long-tail allocation, Minnesota applies pro-rata-by-time-on-risk among triggered primaries (Northern States; Cargill).$$,
  priority_citations = $$[
    "Cargill, Inc. v. Ace Am. Ins. Co., 784 N.W.2d 341 (Minn. 2010)",
    "Domtar, Inc. v. Niagara Fire Ins. Co., 563 N.W.2d 724 (Minn. 1997)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Northern States Power Co. v. Fid. & Cas. Co. of N.Y., 523 N.W.2d 657 (Minn. 1994)"
  ]$$::jsonb
where state_code = 'MN';

-- ── Missouri ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Missouri applies a continuous-trigger / multiple-trigger doctrine for long-tail bodily injury (Doe Run). The duty to defend turns on whether any allegation, taken as true, could potentially fall within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Doe Run Resources Corp. v. American Guar. & Liab. Ins. Co., 531 S.W.3d 508 (Mo. 2017)"
  ]$$::jsonb,
  priority_rule = $$Missouri gives effect to clear and unambiguous policy language and reads competing Other Insurance clauses on their own terms. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies are prorated.$$,
  priority_citations = $$[
    "Doe Run Resources Corp. v. American Guar. & Liab. Ins. Co., 531 S.W.3d 508 (Mo. 2017)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'MO';

-- ── Georgia ─────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Georgia applies a duty-to-defend analysis driven by the allegations of the underlying complaint compared to the policy. If the complaint alleges any covered theory, the duty to defend attaches. Georgia generally treats injury-in-fact as the trigger for property damage and bodily injury claims.$$,
  trigger_citations = $$[
    "Penn-America Ins. Co. v. Disabled American Veterans, Inc., 268 Ga. 740 (1997)",
    "HDI-Gerling Am. Ins. Co. v. Morrison Homes, Inc., 701 F.3d 662 (11th Cir. 2012)"
  ]$$::jsonb,
  priority_rule = $$Georgia gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata, typically by limits. Where one policy is silent and another is excess, the silent policy is primary.$$,
  priority_citations = $$[
    "Penn-America Ins. Co. v. Disabled American Veterans, Inc., 268 Ga. 740 (1997)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'GA';

-- ── Michigan ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Michigan applies an injury-in-fact / continuous-trigger doctrine for long-tail bodily injury and environmental damage (Gelman Sciences). Every policy in effect during the period of actual injury is triggered. The duty to defend arises whenever any allegation potentially falls within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Gelman Sciences, Inc. v. Fid. & Cas. Co. of N.Y., 456 Mich. 305 (1998)",
    "Arco Indus. Corp. v. Am. Motorists Ins. Co., 448 Mich. 395 (1995)"
  ]$$::jsonb,
  priority_rule = $$Michigan gives effect to clear Other Insurance language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies are prorated by limits or by time-on-risk depending on the loss type. For long-tail claims, Michigan applies pro-rata allocation among triggered primaries.$$,
  priority_citations = $$[
    "Gelman Sciences, Inc. v. Fid. & Cas. Co. of N.Y., 456 Mich. 305 (1998)",
    "St. Paul Fire & Marine Ins. Co. v. Am. Home Assur. Co., 444 Mich. 560 (1994)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Gelman Sciences, Inc. v. Fid. & Cas. Co. of N.Y., 456 Mich. 305 (1998)"
  ]$$::jsonb
where state_code = 'MI';

-- ── Virginia ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Virginia applies the eight-corners rule: the duty to defend is determined by comparing the allegations of the underlying complaint to the four corners of the policy. The 'potentiality of coverage' standard governs — if any covered theory is alleged, the duty attaches. Virginia tends to apply manifestation or injury-in-fact triggers rather than continuous trigger absent clear policy language.$$,
  trigger_citations = $$[
    "AES Corp. v. Steadfast Ins. Co., 283 Va. 609 (2012)",
    "CACI Int'l, Inc. v. St. Paul Fire & Marine Ins. Co., 566 F.3d 150 (4th Cir. 2009)"
  ]$$::jsonb,
  priority_rule = $$Virginia gives effect to clear and unambiguous policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata, typically by limits. Virginia courts apply Other Insurance language as written.$$,
  priority_citations = $$[
    "Liberty Mut. Ins. Co. v. Triangle Indus., Inc., 957 F.2d 1153 (4th Cir. 1992)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'VA';

-- ── Indiana ─────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Indiana applies a continuous-trigger doctrine for long-tail bodily injury and progressive property damage (Travelers v. U.S. Filter). Every policy in effect from first exposure through manifestation is triggered. The duty to defend arises whenever the allegations potentially fall within coverage.$$,
  trigger_citations = $$[
    "Travelers Cas. & Sur. Co. v. United States Filter Corp., 895 N.E.2d 1172 (Ind. 2008)",
    "Allstate Ins. Co. v. Dana Corp., 759 N.E.2d 1049 (Ind. 2001)"
  ]$$::jsonb,
  priority_rule = $$Indiana gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata. For long-tail allocation, Indiana applies pro-rata-by-time-on-risk among triggered primaries (U.S. Filter).$$,
  priority_citations = $$[
    "Travelers Cas. & Sur. Co. v. United States Filter Corp., 895 N.E.2d 1172 (Ind. 2008)",
    "Allstate Ins. Co. v. Boles, 481 N.E.2d 1096 (Ind. 1985)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Allstate Ins. Co. v. Dana Corp., 759 N.E.2d 1049 (Ind. 2001)"
  ]$$::jsonb
where state_code = 'IN';

-- ── Wisconsin ───────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Wisconsin applies a continuous-trigger doctrine for long-tail bodily injury (Plastics Engineering). Every policy in effect from first exposure through manifestation is triggered. The duty to defend arises if the underlying complaint alleges any claim potentially within coverage; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "Plastics Eng'g Co. v. Liberty Mut. Ins. Co., 315 Wis.2d 556 (2009)"
  ]$$::jsonb,
  priority_rule = $$Wisconsin gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata-by-time-on-risk for long-tail claims (Plastics Engineering).$$,
  priority_citations = $$[
    "Plastics Eng'g Co. v. Liberty Mut. Ins. Co., 315 Wis.2d 556 (2009)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Plastics Eng'g Co. v. Liberty Mut. Ins. Co., 315 Wis.2d 556 (2009)"
  ]$$::jsonb
where state_code = 'WI';

-- ── Colorado ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Colorado applies a continuous-trigger doctrine for long-tail environmental and bodily injury claims (Public Service Co. of Colo. v. Wallis). Every policy in effect during the period of injury or exposure is triggered. The duty to defend arises whenever any allegation potentially falls within coverage.$$,
  trigger_citations = $$[
    "Public Serv. Co. of Colo. v. Wallis & Cos., 986 P.2d 924 (Colo. 1999)"
  ]$$::jsonb,
  priority_rule = $$Colorado gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata. For long-tail allocation, Colorado applies pro-rata-by-time-on-risk among triggered primaries (Wallis).$$,
  priority_citations = $$[
    "Public Serv. Co. of Colo. v. Wallis & Cos., 986 P.2d 924 (Colo. 1999)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Public Serv. Co. of Colo. v. Wallis & Cos., 986 P.2d 924 (Colo. 1999)"
  ]$$::jsonb
where state_code = 'CO';

-- ── Oregon ──────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Oregon applies a continuous-trigger / injury-in-fact doctrine for long-tail bodily injury and environmental damage (ZRZ Realty). The duty to defend arises if the underlying complaint alleges any claim potentially within coverage; Oregon courts construe coverage grants in the insured's favor.$$,
  trigger_citations = $$[
    "ZRZ Realty Co. v. Beneficial Fire & Cas. Ins. Co., 349 Or. 117 (2010)",
    "Lamb-Weston, Inc. v. Or. Auto. Ins. Co., 219 Or. 110 (1959)"
  ]$$::jsonb,
  priority_rule = $$Oregon was the foundational jurisdiction for the mutually-repugnant rule under Lamb-Weston: when two or more policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata. The rule has become the majority approach nationally and continues to govern in Oregon.$$,
  priority_citations = $$[
    "Lamb-Weston, Inc. v. Or. Auto. Ins. Co., 219 Or. 110 (1959)",
    "ZRZ Realty Co. v. Beneficial Fire & Cas. Ins. Co., 349 Or. 117 (2010)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "ZRZ Realty Co. v. Beneficial Fire & Cas. Ins. Co., 349 Or. 117 (2010)"
  ]$$::jsonb
where state_code = 'OR';
