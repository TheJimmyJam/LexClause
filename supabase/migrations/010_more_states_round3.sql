-- ============================================================================
-- Migration 010 — third tier of state-law catalog
--
-- Adds: NH, VT, RI, HI, ME, LA, TN, SC, IA, KY
--
-- All ten have a controlling decision (state supreme court or controlling
-- federal circuit interpreting state law). The five remaining unseeded states
-- in the queue (AL, AK, AZ, AR, DC, ID, KS, MS, MT, NE, NV, NM, ND, OK, SD,
-- UT, WV, WY, et al.) lack clear high-court coverage-allocation rules and
-- intentionally remain UNDETERMINED — better an honest gap than a fabricated
-- rule.
-- ============================================================================

insert into lc_state_law_rules (state_code, name, default_method, default_trigger, horizontal_exhaustion, targeted_tender_allowed, notes, citations) values

  ('NH','New Hampshire','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Continuous trigger and pro-rata-by-time-on-risk for long-tail environmental claims under EnergyNorth.',
   $$[
     "EnergyNorth Natural Gas, Inc. v. Continental Ins. Co., 146 N.H. 156 (2001)"
   ]$$::jsonb),

  ('VT','Vermont','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail under Towns v. Northern Security.',
   $$[
     "Towns v. Northern Sec. Ins. Co., 184 Vt. 322 (2008)"
   ]$$::jsonb),

  ('RI','Rhode Island','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk under Truk-Away.',
   $$[
     "Truk-Away of R.I., Inc. v. Aetna Cas. & Sur. Co., 723 A.2d 309 (R.I. 1999)"
   ]$$::jsonb),

  ('HI','Hawaii','all_sums','injury_in_fact',false,false,
   'Joint-and-several / all-sums approach under Sentinel; insured may target a triggered carrier.',
   $$[
     "Sentinel Ins. Co. v. First Ins. Co. of Hawaii, 76 Haw. 277 (1994)"
   ]$$::jsonb),

  ('ME','Maine','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Continuous trigger for progressive damage; pro-rata across triggered periods (Coakley).',
   $$[
     "Coakley v. Maine Bonding & Cas. Co., 618 A.2d 777 (Me. 1992)"
   ]$$::jsonb),

  ('LA','Louisiana','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Civil-law jurisdiction. Pro-rata-by-time on continuous-injury asbestos / long-tail under Rando.',
   $$[
     "Rando v. Anco Insulations Inc., 2008-1163 (La. 5/22/09), 16 So. 3d 1065"
   ]$$::jsonb),

  ('TN','Tennessee','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail damage under Standard Fire / Chester O''Donley line.',
   $$[
     "Standard Fire Ins. Co. v. Chester O'Donley & Assocs., 972 S.W.2d 1 (Tenn. Ct. App. 1998)"
   ]$$::jsonb),

  ('SC','South Carolina','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Modified ratable / time-on-risk allocation under Crossmann; statute (S.C. Code § 38-61-70) codifies time-on-risk for some progressive losses.',
   $$[
     "Crossmann Communities of N.C., Inc. v. Harleysville Mut. Ins. Co., 395 S.C. 40 (2011)",
     "S.C. Code Ann. § 38-61-70 (time-on-risk allocation for progressive damage)"
   ]$$::jsonb),

  ('IA','Iowa','pro_rata_time_on_risk','injury_in_fact',true,false,
   'Pro-rata-by-time-on-risk on injury-in-fact trigger for long-tail.',
   $$[
     "Pottawattamie County v. Federated Rural Elec. Ins. Co., 612 N.W.2d 783 (Iowa 2000)"
   ]$$::jsonb),

  ('KY','Kentucky','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail damage under Aetna v. Commonwealth and the federal-circuit applications thereunder.',
   $$[
     "Aetna Cas. & Sur. Co. v. Commonwealth, 179 S.W.3d 830 (Ky. 2005)"
   ]$$::jsonb)

on conflict (state_code) do nothing;
