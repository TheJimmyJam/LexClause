#!/usr/bin/env python3
"""Generate three sample PDFs used by the E2E test:

  1. LibertyMutual_CGL.pdf      — silent Other Insurance clause → expected PRIMARY
  2. Travelers_CGL.pdf          — pure-excess Other Insurance clause → expected EXCESS
  3. Complaint_Acme_v_Greenfield.pdf — TX state-court complaint, BI + PD from a
                                     dropped steel beam (no pollution issue, so
                                     both CGLs trigger and CG 21 49 doesn't bar)

Run:
    pip install reportlab
    python3 gen_sample_pdfs.py
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_CENTER
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib import colors

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'sample_pdfs')
os.makedirs(OUT, exist_ok=True)

styles = getSampleStyleSheet()
title  = ParagraphStyle('title', parent=styles['Heading1'], alignment=TA_CENTER, fontSize=14, spaceAfter=4)
sub    = ParagraphStyle('sub',   parent=styles['Heading2'], alignment=TA_CENTER, fontSize=11, spaceAfter=12, textColor=colors.gray)
hd     = ParagraphStyle('hd',    parent=styles['Heading3'], fontSize=10, spaceBefore=8, spaceAfter=4)
body   = ParagraphStyle('body',  parent=styles['BodyText'], fontSize=10, leading=13, spaceAfter=4)


def build_pdf(path, story):
    doc = SimpleDocTemplate(
        path, pagesize=letter,
        leftMargin=0.7*inch, rightMargin=0.7*inch,
        topMargin=0.6*inch,  bottomMargin=0.6*inch,
    )
    doc.build(story)


# ── Liberty Mutual CGL (silent Other Insurance — should be PRIMARY) ─────────
liberty = [
    Paragraph('LIBERTY MUTUAL INSURANCE COMPANY', title),
    Paragraph('Commercial General Liability Policy — Declarations', sub),
    Spacer(1, 8),

    Paragraph('Policy Number: <b>LM-CGL-2024-7788</b>', body),
    Paragraph('Named Insured: <b>Greenfield Builders LLC</b>', body),
    Paragraph('Policy Period: <b>January 1, 2024 to January 1, 2025</b> (12:01 a.m. Standard Time)', body),
    Paragraph('State Where Issued: <b>Texas</b>', body),
    Paragraph('Coverage Form: <b>CG 00 01 04 13</b> (Commercial General Liability — Occurrence)', body),

    Paragraph('LIMITS OF INSURANCE', hd),
    Paragraph('Each Occurrence Limit: <b>$1,000,000</b>', body),
    Paragraph('General Aggregate Limit: <b>$2,000,000</b>', body),
    Paragraph('Self-Insured Retention: <b>$0</b>', body),
    Paragraph('Deductible: <b>$0</b>', body),

    Paragraph('OTHER INSURANCE', hd),
    Paragraph(
        'This policy contains no special "Other Insurance" provision. '
        'Coverage is primary and applies on a first-dollar basis to the '
        'extent provided by the policy form CG 00 01 04 13.',
        body),

    Paragraph('EXCLUSIONS', hd),
    Paragraph(
        '<b>Pollution Exclusion (CG 21 49):</b> This insurance does not apply '
        'to bodily injury or property damage which would not have occurred in '
        'whole or part but for the actual, alleged or threatened discharge, '
        'dispersal, seepage, migration, release or escape of pollutants at any '
        'time. (This exclusion applies only to releases of pollutants and does '
        'not bar ordinary construction-site bodily injury or property damage.)',
        body),
]
build_pdf(os.path.join(OUT, 'LibertyMutual_CGL.pdf'), liberty)


# ── Travelers CGL (pure-excess Other Insurance — should be EXCESS) ──────────
travelers = [
    Paragraph('TRAVELERS INSURANCE COMPANY', title),
    Paragraph('Commercial General Liability Policy — Declarations', sub),
    Spacer(1, 8),

    Paragraph('Policy Number: <b>TRV-CGL-2024-4421</b>', body),
    Paragraph('Named Insured: <b>Greenfield Builders LLC</b>', body),
    Paragraph('Policy Period: <b>March 1, 2024 to March 1, 2025</b>', body),
    Paragraph('State Where Issued: <b>Texas</b>', body),
    Paragraph('Coverage Form: <b>CG 00 01 04 13</b> (Commercial General Liability — Occurrence)', body),

    Paragraph('LIMITS OF INSURANCE', hd),
    Paragraph('Each Occurrence Limit: <b>$1,000,000</b>', body),
    Paragraph('General Aggregate Limit: <b>$2,000,000</b>', body),
    Paragraph('Self-Insured Retention: <b>$0</b>', body),

    Paragraph('OTHER INSURANCE PROVISION', hd),
    Paragraph(
        '<b>"This insurance is excess over any other valid and collectible '
        'insurance available to the insured, whether such other insurance is '
        'primary, excess, contingent, or on any other basis."</b>',
        body),

    Paragraph('EXCLUSIONS', hd),
    Paragraph(
        '<b>Pollution Exclusion (CG 21 49):</b> This insurance does not apply '
        'to bodily injury or property damage which would not have occurred in '
        'whole or part but for the actual, alleged or threatened discharge, '
        'dispersal, seepage, migration, release or escape of pollutants.',
        body),
]
build_pdf(os.path.join(OUT, 'Travelers_CGL.pdf'), travelers)


# ── Complaint (Texas state court, BI + PD from a dropped steel beam) ────────
complaint = [
    Paragraph('IN THE DISTRICT COURT OF DALLAS COUNTY, TEXAS', title),
    Paragraph('116TH JUDICIAL DISTRICT', sub),

    Paragraph(
        '<b>ACME PROPERTIES, LLC,</b><br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;Plaintiff,<br/><br/>'
        'v.<br/><br/>'
        '<b>GREENFIELD BUILDERS LLC,</b><br/>'
        '&nbsp;&nbsp;&nbsp;&nbsp;Defendant.<br/><br/>'
        'Civil Action No. 2024-DC-00845',
        body),

    Spacer(1, 12),
    Paragraph("PLAINTIFF'S ORIGINAL PETITION", hd),

    Paragraph(
        'Plaintiff Acme Properties, LLC files this Original Petition '
        'against Defendant Greenfield Builders LLC and respectfully shows the Court as follows:',
        body),

    Paragraph('I. PARTIES AND VENUE', hd),
    Paragraph(
        'Plaintiff is a Texas limited liability company with its principal place of business in Dallas County, Texas. '
        'Defendant Greenfield Builders LLC is a Texas LLC operating a construction business in Dallas County, Texas. '
        'Venue is proper in this Court because the events giving rise to this action occurred at 123 Main Street, Dallas, Texas.',
        body),

    Paragraph('II. FACTUAL BACKGROUND', hd),
    Paragraph(
        'On August 15, 2024, Defendant was operating a tower crane on its construction project at 123 Main Street, Dallas, Texas. '
        'Defendant negligently allowed a steel I-beam to drop from the crane during a lift operation. '
        'The beam fell onto the parking lot of the adjoining property owned by Plaintiff, crushing a vehicle parked on the lot '
        'and striking John Doe, a tenant of Plaintiff who was walking to his vehicle at the time of the incident.',
        body),

    Paragraph('III. COUNT I — NEGLIGENCE (PROPERTY DAMAGE)', hd),
    Paragraph(
        'Defendant owed a duty to Plaintiff to operate its construction equipment with reasonable care. '
        'Defendant breached that duty by failing to properly secure the steel beam during the crane lift, '
        'directly and proximately causing property damage to the parked vehicle on Plaintiff\'s property. '
        'Plaintiff seeks compensatory damages for the property damage in an amount no less than $85,000.',
        body),

    Paragraph('IV. COUNT II — NEGLIGENCE (BODILY INJURY)', hd),
    Paragraph(
        'Defendant\'s same negligent conduct directly and proximately caused bodily injuries to John Doe, '
        'a tenant of Plaintiff. Mr. Doe suffered a broken right arm, multiple lacerations, and ongoing back pain '
        'requiring physical therapy. Plaintiff, as the leaseholder, brings this claim on behalf of Mr. Doe '
        'and seeks compensatory damages for medical expenses, pain and suffering, and lost wages '
        'in an amount no less than $750,000.',
        body),

    Paragraph('V. PRAYER FOR RELIEF', hd),
    Paragraph(
        'Plaintiff prays for judgment against Defendant for compensatory damages totaling no less than $835,000, '
        'plus pre- and post-judgment interest, attorneys\' fees, and costs of court.',
        body),
]
build_pdf(os.path.join(OUT, 'Complaint_Acme_v_Greenfield.pdf'), complaint)

print(f'Wrote sample PDFs to {OUT}')
for f in sorted(os.listdir(OUT)):
    print(f'  - {f}')
