-- ============================================================================
-- Migration 007 — add MD, MI, VA to the state-law catalog
--
-- Tier-2 round 2. All three have established (if less-developed) coverage law.
-- Notes flag where current authority should be re-confirmed for a real matter.
-- ============================================================================

insert into lc_state_law_rules (state_code, name, default_method, default_trigger, horizontal_exhaustion, targeted_tender_allowed, notes, citations) values

  ('MD','Maryland','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail. Continuous trigger under Lloyd E. Mitchell. Maryland follows the Owens-Illinois-style allocation.',
   $$[
     "Lloyd E. Mitchell, Inc. v. Maryland Casualty Co., 324 Md. 44 (1991)",
     "Mayor & City Council of Baltimore v. Utica Mut. Ins. Co., 145 Md. App. 256 (2002)",
     "Riley v. United Servs. Auto. Ass'n, 161 Md. App. 573 (2005)"
   ]$$::jsonb),

  ('MI','Michigan','pro_rata_time_on_risk','continuous_trigger',true,false,
   'Pro-rata-by-time-on-risk for long-tail environmental claims. Continuous trigger under Gelman Sciences. Note: Michigan coverage law has shifted multiple times — confirm current authority on any specific issue.',
   $$[
     "Gelman Sciences, Inc. v. Fidelity & Cas. Co. of N.Y., 456 Mich. 305 (1998)",
     "Arco Indus. Corp. v. Am. Motorists Ins. Co., 448 Mich. 395 (1995)"
   ]$$::jsonb),

  ('VA','Virginia','pro_rata_time_on_risk','manifestation',true,false,
   'Manifestation trigger predominates for property-damage claims. Pro-rata where multiple periods are implicated. Virginia has comparatively limited coverage-allocation case law — verify current authority before relying.',
   $$[
     "Reisen v. Aetna Life & Cas. Co., 225 Va. 327 (1983)",
     "Morrow Corp. v. Harleysville Mut. Ins. Co., 101 F. Supp. 2d 422 (E.D. Va. 2000)",
     "Phila. Indem. Ins. Co. v. Coleman, 372 F.3d 207 (4th Cir. 2004)"
   ]$$::jsonb)

on conflict (state_code) do nothing;
