-- ============================================================================
-- Migration 012 — seed the coverage_priority catalog for the top 10 states
--
-- Populates the new columns added in migration 011 (trigger_test,
-- trigger_citations, priority_rule, priority_citations, exhaustion_rule_text,
-- exhaustion_citations) on lc_state_law_rules. This is the live ground truth
-- the COVERAGE_PRIORITY_SYSTEM prompt pins Claude to. No citation in this
-- file is derivative of treatise text — every cite is a published, public
-- court decision. The narratives are short summaries written for prompt
-- consumption.
--
-- States covered (top-10 commercial coverage jurisdictions): CA, NY, TX, IL,
-- NJ, MA, PA, FL, OH, WA. Tier-2 and tier-3 states will be seeded in follow-
-- up migrations as real matters demand them. Until then, those states will
-- produce "no citation in catalog for this point" output, which is the
-- correct conservative behaviour.
-- ============================================================================

-- ── California ──────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$California applies a 'potentiality of coverage' standard. The duty to defend arises whenever the underlying complaint creates a potential for coverage, evaluated at the outset of the litigation. The court considers both the allegations and any extrinsic facts known to the insurer. For long-tail injury (asbestos, environmental, continuous bodily injury), California applies a continuous-trigger theory: every policy in effect from first exposure through manifestation is triggered.$$,
  trigger_citations = $$[
    "Gray v. Zurich Ins. Co., 65 Cal.2d 263 (1966)",
    "Montrose Chem. Corp. v. Admiral Ins. Co., 10 Cal.4th 645 (1995)",
    "Buss v. Superior Court, 16 Cal.4th 35 (1997)",
    "Aerojet-General Corp. v. Transport Indem. Co., 17 Cal.4th 38 (1997)"
  ]$$::jsonb,
  priority_rule = $$California gives effect to the plain language of policy provisions, including Other Insurance clauses. When two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the burden is shared among the co-excess policies, typically prorated by limits or equal shares depending on the policy language and the equities. Targeted-tender (selective tender) is permitted in California: an insured may select which carrier to tender a claim to, and a non-selected carrier has no contribution obligation absent contrary policy language. A 'closest-to-the-risk' analysis may apply where one policy is more specifically tailored to the loss than another.$$,
  priority_citations = $$[
    "Fireman's Fund Ins. Co. v. Maryland Cas. Co., 65 Cal.App.4th 1279 (1998)",
    "Dart Indus., Inc. v. Commercial Union Ins. Co., 28 Cal.4th 1059 (2002)",
    "Reliance Nat'l Indem. Co. v. Gen. Star Indem. Co., 72 Cal.App.4th 1063 (1999)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "Montrose Chem. Corp. v. Superior Court, 9 Cal.5th 215 (2020)"
  ]$$::jsonb
where state_code = 'CA';

-- ── New York ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$New York applies the 'potentiality of coverage' standard for the duty to defend: an insurer is required to defend whenever the four corners of the underlying complaint suggest a reasonable possibility of coverage. For long-tail bodily injury (asbestos, environmental), New York applies a continuous-trigger doctrine: every policy in effect from first exposure through manifestation is triggered. Allegations are construed liberally in favor of the insured for purposes of the duty to defend.$$,
  trigger_citations = $$[
    "Continental Cas. Co. v. Rapid-American Corp., 80 N.Y.2d 640 (1993)",
    "Consol. Edison Co. of N.Y. v. Allstate Ins. Co., 98 N.Y.2d 208 (2002)",
    "Fitzpatrick v. American Honda Motor Co., 78 N.Y.2d 61 (1991)"
  ]$$::jsonb,
  priority_rule = $$New York reads competing 'Other Insurance' clauses together and seeks to give effect to each where possible. When two or more policies covering the same loss each contain pure-excess Other Insurance clauses, the clauses are treated as mutually repugnant and disregarded; the policies are then prorated, typically by limits or by time-on-risk depending on the loss type. For long-tail losses spanning multiple policy years, New York follows pro-rata allocation by time-on-risk among triggered primaries. A primary-and-non-contributory endorsement requires a written contract between the insureds to fire.$$,
  priority_citations = $$[
    "State Farm Fire & Cas. Co. v. LiMauro, 65 N.Y.2d 369 (1985)",
    "Lumbermens Mut. Cas. Co. v. Allstate Ins. Co., 51 N.Y.2d 651 (1980)",
    "Consol. Edison Co. of N.Y. v. Allstate Ins. Co., 98 N.Y.2d 208 (2002)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "In re Viking Pump, Inc., 27 N.Y.3d 244 (2016)",
    "Olin Corp. v. American Home Assur. Co., 704 F.3d 89 (2d Cir. 2012)"
  ]$$::jsonb
where state_code = 'NY';

-- ── Texas ───────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Texas applies the eight-corners rule: the duty to defend is determined by comparing the four corners of the underlying complaint to the four corners of the policy. Allegations are taken as true and ambiguity is resolved in favor of the insured. If any allegation potentially falls within coverage, the duty to defend attaches. For long-tail bodily injury claims, Texas applies an exposure-based or continuous-trigger analysis depending on the disease (e.g. continuous trigger for property damage under Don's Building Supply; exposure-in-residence treatment for some bodily injury). Extrinsic evidence is admissible only in narrow circumstances.$$,
  trigger_citations = $$[
    "GuideOne Elite Ins. Co. v. Fielder Rd. Baptist Church, 197 S.W.3d 305 (Tex. 2006)",
    "Don's Bldg. Supply, Inc. v. OneBeacon Ins. Co., 267 S.W.3d 20 (Tex. 2008)",
    "Northfield Ins. Co. v. Loving Home Care, Inc., 363 F.3d 523 (5th Cir. 2004)"
  ]$$::jsonb,
  priority_rule = $$Texas gives effect to clear and unambiguous policy language. Each policy's Other Insurance clause is read on its own terms. Where one policy's Other Insurance clause is silent or designates the policy as primary and another contains a pure-excess clause, the silent/primary policy is primary and the excess clause is given effect. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant; the policies are read together and prorated by limits among the co-excess policies, unless the policy language itself directs a different result.$$,
  priority_citations = $$[
    "Mid-Continent Ins. Co. v. Liberty Mut. Ins. Co., 236 S.W.3d 765 (Tex. 2007)",
    "Hardware Dealers Mut. Fire Ins. Co. v. Farmers Ins. Exch., 444 S.W.2d 583 (Tex. 1969)",
    "Trinity Universal Ins. Co. v. Employers Mut. Cas. Co., 592 F.3d 687 (5th Cir. 2010)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "Keck, Mahin & Cate v. Nat'l Union Fire Ins. Co. of Pittsburgh, 20 S.W.3d 692 (Tex. 2000)"
  ]$$::jsonb
where state_code = 'TX';

-- ── Illinois ────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Illinois applies a 'potentiality of coverage' standard analogous to the eight-corners rule. The duty to defend turns on whether the allegations of the underlying complaint, liberally construed in favor of the insured, potentially fall within coverage; if any covered theory is alleged, the duty to defend attaches. For long-tail bodily injury and continuous environmental damage, Illinois applies a continuous-trigger doctrine.$$,
  trigger_citations = $$[
    "Wilkin Insulation Co. v. United States Fid. & Guar. Co., 144 Ill.2d 64 (1991)",
    "United States Gypsum Co. v. Admiral Ins. Co., 268 Ill.App.3d 598 (1994)",
    "Outboard Marine Corp. v. Liberty Mut. Ins. Co., 154 Ill.2d 90 (1992)"
  ]$$::jsonb,
  priority_rule = $$Illinois recognizes targeted-tender (selective tender): an insured with multiple primary policies may tender a claim to one carrier and the non-tendered carriers owe no defense or indemnity contribution. Targeted tender is a hard constraint at the priority stage — non-tendered carriers receive no allocation regardless of their Other Insurance language. Where targeted tender is not exercised and competing pure-excess Other Insurance clauses exist, the clauses are treated as mutually repugnant and the policies share pro-rata. Illinois enforces 'true excess' status under Kajima where umbrella/excess policies are sequenced behind primary coverage.$$,
  priority_citations = $$[
    "John Burns Constr. Co. v. Indiana Ins. Co., 189 Ill.2d 570 (2000)",
    "Kajima Constr. Servs., Inc. v. St. Paul Fire & Marine Ins. Co., 227 Ill.2d 102 (2007)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Kajima Constr. Servs., Inc. v. St. Paul Fire & Marine Ins. Co., 227 Ill.2d 102 (2007)"
  ]$$::jsonb
where state_code = 'IL';

-- ── New Jersey ──────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$New Jersey applies a continuous-trigger doctrine for long-tail bodily injury and progressive property damage (Owens-Illinois): every policy in effect from initial exposure through manifestation is triggered. For the duty to defend, New Jersey applies a potentiality-of-coverage test: if the allegations, taken as true and liberally construed, potentially fall within coverage, the duty attaches.$$,
  trigger_citations = $$[
    "Owens-Illinois, Inc. v. United Ins. Co., 138 N.J. 437 (1994)",
    "Carter-Wallace, Inc. v. Admiral Ins. Co., 154 N.J. 312 (1998)"
  ]$$::jsonb,
  priority_rule = $$New Jersey gives effect to clear policy language but treats competing pure-excess Other Insurance clauses as mutually repugnant, prorating among the co-excess policies. For long-tail claims, New Jersey applies the Owens-Illinois pro-rata-by-time-on-risk allocation among triggered primaries, with non-cumulation clauses given effect post-Spaulding only as to the same insurer.$$,
  priority_citations = $$[
    "Owens-Illinois, Inc. v. United Ins. Co., 138 N.J. 437 (1994)",
    "Carter-Wallace, Inc. v. Admiral Ins. Co., 154 N.J. 312 (1998)",
    "Spaulding Composites Co. v. Aetna Cas. & Sur. Co., 176 N.J. 25 (2003)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Continental Ins. Co. v. Honeywell Int'l, Inc., 234 N.J. 23 (2018)",
    "Owens-Illinois, Inc. v. United Ins. Co., 138 N.J. 437 (1994)"
  ]$$::jsonb
where state_code = 'NJ';

-- ── Massachusetts ───────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Massachusetts applies a continuous-trigger doctrine for long-tail bodily injury and progressive environmental damage (Boston Gas). The duty to defend turns on whether the allegations are 'reasonably susceptible' of an interpretation that they state a claim within coverage; if they do, the duty attaches.$$,
  trigger_citations = $$[
    "Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)",
    "A.W. Chesterton Co. v. Massachusetts Insurers Insolvency Fund, 445 Mass. 502 (2005)"
  ]$$::jsonb,
  priority_rule = $$Massachusetts gives effect to clear and unambiguous policy language. Where two or more triggered primary policies each contain pure-excess Other Insurance clauses, the clauses are deemed mutually repugnant and the policies share pro-rata, typically by limits or time-on-risk in a long-tail setting. Boston Gas instructs courts to apply pro-rata-by-time-on-risk for long-tail allocation among triggered primaries.$$,
  priority_citations = $$[
    "Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)",
    "Liberty Mut. Ins. Co. v. SCA Servs., Inc., 412 Mass. 330 (1992)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)"
  ]$$::jsonb
where state_code = 'MA';

-- ── Pennsylvania ────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Pennsylvania applies a multiple-trigger / continuous-trigger doctrine for long-tail bodily injury (J.H. France Refractories): every policy in effect from initial exposure through manifestation is triggered. The duty to defend is determined by comparing the underlying allegations to the coverage grant; if any potentially covered theory is alleged, the duty attaches.$$,
  trigger_citations = $$[
    "J.H. France Refractories Co. v. Allstate Ins. Co., 534 Pa. 29 (1993)",
    "Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)"
  ]$$::jsonb,
  priority_rule = $$Pennsylvania gives effect to clear and unambiguous policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, the clauses are mutually repugnant and the policies share pro-rata. Pennsylvania National Mutual v. St. John reaffirms that policy language controls and that courts must apply each provision as written.$$,
  priority_citations = $$[
    "Pennsylvania Nat'l Mut. Cas. Ins. Co. v. St. John, 106 A.3d 1 (Pa. 2014)",
    "Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)"
  ]$$::jsonb,
  exhaustion_rule_text = 'horizontal',
  exhaustion_citations = $$[
    "Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)"
  ]$$::jsonb
where state_code = 'PA';

-- ── Florida ─────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Florida applies an eight-corners rule for the duty to defend: the duty is determined from the allegations of the underlying complaint compared to the policy. Ambiguity is resolved in favor of the insured. For property-damage claims, Florida applies a continuous-trigger / injury-in-fact analysis (Trizec).$$,
  trigger_citations = $$[
    "Trizec Props., Inc. v. Biltmore Constr. Co., 767 F.2d 810 (11th Cir. 1985)",
    "State Farm Fire & Cas. Co. v. CTC Dev. Corp., 720 So.2d 1072 (Fla. 1998)"
  ]$$::jsonb,
  priority_rule = $$Florida gives effect to clear policy language. Where two or more triggered policies each contain pure-excess Other Insurance clauses, Florida courts treat them as mutually repugnant and apportion liability pro-rata. Where one policy is silent and another is excess, the silent policy is primary.$$,
  priority_citations = $$[
    "Carrousel Concessions, Inc. v. Fla. Ins. Guar. Ass'n, 483 So.2d 513 (Fla. Dist. Ct. App. 1986)",
    "Trizec Props., Inc. v. Biltmore Constr. Co., 767 F.2d 810 (11th Cir. 1985)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[]$$::jsonb
where state_code = 'FL';

-- ── Ohio ────────────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Ohio applies a continuous-trigger doctrine for long-tail bodily injury and progressive property damage (Goodyear). The duty to defend arises if the underlying complaint alleges any claim potentially within coverage, with the allegations construed liberally in favor of the insured.$$,
  trigger_citations = $$[
    "Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St.3d 512 (2002)",
    "Wedge Prods., Inc. v. Hartford Equity Sales Co., 31 Ohio St.3d 65 (1987)"
  ]$$::jsonb,
  priority_rule = $$Ohio applies an 'all-sums' allocation under Goodyear: an insured may select any one triggered policy and demand full indemnification up to the limits of that policy, with rights of contribution preserved among insurers. For the priority question among triggered policies, Ohio gives effect to clear Other Insurance clauses; competing pure-excess clauses are mutually repugnant and the policies share pro-rata absent the insured's exercise of all-sums selection.$$,
  priority_citations = $$[
    "Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St.3d 512 (2002)",
    "Pennsylvania Gen. Ins. Co. v. Park-Ohio Indus., 126 Ohio St.3d 98 (2010)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St.3d 512 (2002)"
  ]$$::jsonb
where state_code = 'OH';

-- ── Washington ──────────────────────────────────────────────────────────────
update lc_state_law_rules set
  trigger_test = $$Washington applies a continuous-trigger doctrine for long-tail bodily injury and progressive environmental damage. The duty to defend arises if the underlying complaint contains allegations that are conceivably covered; ambiguity is resolved in favor of the insured.$$,
  trigger_citations = $$[
    "B&L Trucking & Constr. Co. v. Northern Ins. Co., 134 Wash.2d 413 (1998)"
  ]$$::jsonb,
  priority_rule = $$Washington applies an all-sums approach following B&L Trucking: an insured may select any one triggered policy and demand indemnification up to its limits, with the selected insurer entitled to contribution from co-insurers. For the priority question among triggered policies, Washington gives effect to plain Other Insurance language; competing pure-excess clauses are mutually repugnant and shared pro-rata absent the insured's selection.$$,
  priority_citations = $$[
    "B&L Trucking & Constr. Co. v. Northern Ins. Co., 134 Wash.2d 413 (1998)"
  ]$$::jsonb,
  exhaustion_rule_text = 'vertical',
  exhaustion_citations = $$[
    "B&L Trucking & Constr. Co. v. Northern Ins. Co., 134 Wash.2d 413 (1998)"
  ]$$::jsonb
where state_code = 'WA';
