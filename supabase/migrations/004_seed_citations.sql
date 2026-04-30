-- ============================================================================
-- Migration 004 — populate citations on lc_state_law_rules
--
-- The seed in 001 set the `notes` column but left `citations` empty. Without
-- a curated list, the analysis engine sometimes fabricated case names from
-- training data (e.g. citing the 1994 Court of Appeal Montrose II opinion
-- instead of the controlling 2020 California Supreme Court decision). This
-- migration loads vetted citations for the 10 seeded states.
-- ============================================================================

update lc_state_law_rules set citations = $$[
  "Montrose Chem. Corp. v. Admiral Ins. (Montrose I), 10 Cal.4th 645 (1995)",
  "Montrose Chem. Corp. v. Superior Court (Montrose II), 9 Cal.5th 215 (2020)",
  "Fireman's Fund Ins. Co. v. Maryland Casualty Co., 65 Cal.App.4th 1279 (1998)"
]$$::jsonb where state_code = 'CA';

update lc_state_law_rules set citations = $$[
  "Owens-Illinois, Inc. v. United Ins. Co., 138 N.J. 437 (1994)",
  "Carter-Wallace, Inc. v. Admiral Ins. Co., 154 N.J. 312 (1998)",
  "Spaulding Composites Co. v. Aetna Cas. & Sur. Co., 176 N.J. 25 (2003)"
]$$::jsonb where state_code = 'NJ';

update lc_state_law_rules set citations = $$[
  "Consol. Edison Co. of N.Y. v. Allstate Ins. Co., 98 N.Y.2d 208 (2002)",
  "In re Viking Pump, Inc., 27 N.Y.3d 244 (2016)"
]$$::jsonb where state_code = 'NY';

update lc_state_law_rules set citations = $$[
  "John Burns Constr. Co. v. Indiana Ins. Co., 189 Ill.2d 570 (2000)",
  "Kajima Constr. Servs., Inc. v. St. Paul Fire & Marine Ins. Co., 227 Ill.2d 102 (2007)"
]$$::jsonb where state_code = 'IL';

update lc_state_law_rules set citations = $$[
  "Boston Gas Co. v. Century Indem. Co., 454 Mass. 337 (2009)"
]$$::jsonb where state_code = 'MA';

update lc_state_law_rules set citations = $$[
  "Koppers Co. v. Aetna Cas. & Sur. Co., 98 F.3d 1440 (3d Cir. 1996)",
  "Pa. Nat'l Mut. Cas. Ins. Co. v. St. John, 106 A.3d 1 (Pa. 2014)"
]$$::jsonb where state_code = 'PA';

update lc_state_law_rules set citations = $$[
  "Don's Bldg. Supply, Inc. v. OneBeacon Ins. Co., 267 S.W.3d 20 (Tex. 2008)",
  "Lennar Corp. v. Markel Am. Ins. Co., 413 S.W.3d 750 (Tex. 2013)"
]$$::jsonb where state_code = 'TX';

update lc_state_law_rules set citations = $$[
  "Trizec Props., Inc. v. Biltmore Constr. Co., 767 F.2d 810 (11th Cir. 1985)",
  "Carrousel Concessions, Inc. v. Fla. Ins. Guar. Ass'n, 483 So. 2d 513 (Fla. Dist. Ct. App. 1986)"
]$$::jsonb where state_code = 'FL';

update lc_state_law_rules set citations = $$[
  "American Nat'l Fire Ins. Co. v. B&L Trucking & Constr. Co., 134 Wn.2d 413 (1998)"
]$$::jsonb where state_code = 'WA';

update lc_state_law_rules set citations = $$[
  "Goodyear Tire & Rubber Co. v. Aetna Cas. & Sur. Co., 95 Ohio St. 3d 512 (2002)"
]$$::jsonb where state_code = 'OH';
