-- ============================================================================
-- Migration 005 — expand state-law catalog
--
-- Adds a curated tier-2 set of jurisdictions: CT, CO, MN, IN, WI, MO, DE, NC,
-- GA, OR. All entries are anchored to a state-supreme-court (or controlling
-- federal-circuit) decision. Conservative — anything below "high-court rule"
-- stays out until we hit a real matter that needs it.
-- ============================================================================

insert into lc_state_law_rules (state_code, name, default_method, default_trigger, horizontal_exhaustion, targeted_tender_allowed, notes, citations) values
  ('CT','Connecticut','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail occurrences. Continuous trigger generally applies to progressive injuries.',
   $$[
     "Sec. Ins. Co. of Hartford v. Lumbermens Mut. Cas. Co., 264 Conn. 688 (2003)",
     "R.T. Vanderbilt Co. v. Hartford Accident & Indem. Co., 333 Conn. 343 (2019)"
   ]$$::jsonb),

  ('CO','Colorado','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for environmental and other long-tail losses (Wallis).',
   $$[
     "Public Service Co. of Colorado v. Wallis & Companies, 986 P.2d 924 (Colo. 1999)"
   ]$$::jsonb),

  ('MN','Minnesota','all_sums','actual_injury',false,false,
   'Joint-and-several / all-sums under Silicone Implant; insured may target a single triggered policy.',
   $$[
     "In re Silicone Implant Ins. Coverage Litig., 667 N.W.2d 405 (Minn. 2003)",
     "Northern States Power Co. v. Fidelity & Cas. Co. of N.Y., 523 N.W.2d 657 (Minn. 1994)"
   ]$$::jsonb),

  ('IN','Indiana','all_sums','continuous_trigger',false,false,
   'All-sums under Dana Corp.; insured may pick any triggered policy with rights of contribution among co-insurers.',
   $$[
     "Allstate Ins. Co. v. Dana Corp., 759 N.E.2d 1049 (Ind. 2001)"
   ]$$::jsonb),

  ('WI','Wisconsin','all_sums_with_reallocation','continuous_trigger',false,false,
   'All-sums with subsequent reallocation among co-insurers (Plastics Engineering).',
   $$[
     "Plastics Eng'g Co. v. Liberty Mut. Ins. Co., 759 N.W.2d 613 (Wis. 2009)"
   ]$$::jsonb),

  ('MO','Missouri','all_sums','continuous_trigger',false,false,
   'Joint-and-several / all-sums for long-tail environmental claims under Doe Run.',
   $$[
     "Doe Run Resources Corp. v. American Guar. & Liab. Ins., 531 S.W.3d 508 (Mo. 2017)"
   ]$$::jsonb),

  ('DE','Delaware','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for environmental long-tail (Hercules).',
   $$[
     "Hercules Inc. v. AIU Ins. Co., 784 A.2d 481 (Del. 2001)",
     "In re Viking Pump Inc., 148 A.3d 633 (Del. 2016)"
   ]$$::jsonb),

  ('NC','North Carolina','pro_rata_time_on_risk','injury_in_fact',true,false,
   'Pro-rata-by-time on injury-in-fact for long-tail damage (Gaston County Dyeing).',
   $$[
     "Gaston County Dyeing Mach. Co. v. Northfield Ins. Co., 351 N.C. 293 (2000)"
   ]$$::jsonb),

  ('GA','Georgia','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Continuous-trigger / pro-rata for environmental and progressive-damage occurrences.',
   $$[
     "Continental Cas. Co. v. H.S.I. Fin. Servs., 266 Ga. 260 (1996)",
     "HDI-Gerling America Ins. Co. v. Morrison Homes, Inc., 701 F.3d 662 (11th Cir. 2012)"
   ]$$::jsonb),

  ('OR','Oregon','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time mandated by ORS 465.480 for environmental claims; common law follows similar approach for other long-tail losses.',
   $$[
     "ORS 465.480 (Oregon Environmental Cleanup Assistance Act)",
     "Lamb-Weston, Inc. v. Or. Auto. Ins. Co., 219 Or. 110 (1959)"
   ]$$::jsonb)
on conflict (state_code) do nothing;
