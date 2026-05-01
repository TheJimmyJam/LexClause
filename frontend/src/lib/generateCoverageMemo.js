// generateCoverageMemo.js
//
// Produces a professional coverage-priority opinion memo from a completed
// analysis. Two formats: .docx (attorney-editable) and .pdf (finalized).
//
// Output is a Trigger / Priority / Exhaustion opinion, NOT a dollar
// allocation. Matches the v0.3 coverage-priority engine output. Citations
// come from the supplied analysis (which itself comes from the curated
// state-law catalog) and are surfaced under their respective sections.
//
// Usage:
//   import { downloadMemoDocx, downloadMemoPdf } from '../lib/generateCoverageMemo.js'
//   await downloadMemoDocx({ analysis, matter, results, organization })
//
// Inputs:
//   analysis      — row from lc_analyses (mode = 'coverage_priority')
//   matter        — row from lc_matters (with .allegations[])
//   results       — array from lc_analysis_results
//   organization  — { name } from lc_organizations (optional)

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageNumber, Header, Footer,
} from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Brand palette (matches index.css :root brand tokens) ────────────────────
const BRAND_HEX  = '2563EB'   // brand-600
const DARK_HEX   = '0F172A'   // slate-900
const MID_HEX    = '475569'   // slate-600
const SOFT_HEX   = '64748B'   // slate-500
const FAINT_HEX  = '94A3B8'   // slate-400
const LIGHT_HEX  = 'F1F5F9'   // slate-100
const BRAND_LT   = 'EFF6FF'   // brand-50
const AMBER_HEX  = 'B45309'
const BORDER_HEX = 'CBD5E1'   // slate-300
const EMERALD_HEX= '047857'

// PDF (RGB tuples)
const BRAND = [37, 99, 235]
const DARK  = [15, 23, 42]
const MID   = [71, 85, 105]
const SOFT  = [100, 116, 139]
const FAINT = [148, 163, 184]
const LIGHT = [241, 245, 249]
const BRAND_LIGHT = [239, 246, 255]
const AMBER = [180, 83, 9]
const EMERALD = [4, 120, 87]

// ── Shared helpers ──────────────────────────────────────────────────────────
function todayLong() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
function safeFilename(s) {
  return String(s || 'matter').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80)
}
function cap(s) {
  if (!s) return '—'
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function triggeredLabel(t) {
  if (t === 'yes')     return 'TRIGGERED'
  if (t === 'partial') return 'PARTIAL'
  if (t === 'no')      return 'NOT TRIGGERED'
  return '—'
}
function rankLabel(r) {
  if (!r) return '—'
  return cap(r)  // primary, co-primary, excess, sub-excess
}
function asArray(v) {
  if (Array.isArray(v)) return v
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); return Array.isArray(j) ? j : [] } catch { return [] }
  }
  return []
}

// ── DOCX primitives ─────────────────────────────────────────────────────────
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    alignment: opts.alignment || AlignmentType.LEFT,
    children: [new TextRun({
      text:    text || '',
      bold:    !!opts.bold,
      italics: !!opts.italics,
      color:   opts.color,
      size:    opts.size,
      font:    'Calibri',
    })],
  })
}
function H(text, level = HeadingLevel.HEADING_1) {
  return new Paragraph({
    heading: level,
    spacing: { before: 240, after: 120 },
    children: [new TextRun({ text, bold: true, font: 'Calibri' })],
  })
}
const NO_BORDER = {
  top:    { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left:   { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right:  { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
}
const THIN_BORDER = {
  top:    { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
  left:   { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
  right:  { style: BorderStyle.SINGLE, size: 4, color: BORDER_HEX },
}

function metaCell(label, value) {
  return new TableCell({
    borders: NO_BORDER,
    margins: { top: 60, bottom: 60, left: 0, right: 200 },
    children: [
      new Paragraph({ children: [
        new TextRun({ text: label, bold: true, font: 'Calibri', size: 22, color: MID_HEX }),
        new TextRun({ text: '\t' + (value || '—'), font: 'Calibri', size: 22, color: DARK_HEX }),
      ] }),
    ],
  })
}
function tdHead(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: THIN_BORDER,
    shading: { type: ShadingType.SOLID, color: LIGHT_HEX, fill: LIGHT_HEX },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: 'Calibri', size: 18, color: MID_HEX })] })],
  })
}
function td(text, opts = {}) {
  return new TableCell({
    borders: THIN_BORDER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, font: 'Calibri', size: 20, color: opts.color || DARK_HEX })],
    })],
  })
}

// ── DOCX build ──────────────────────────────────────────────────────────────
export async function buildMemoDocx({ analysis, matter, results, organization }) {
  const allResults = (results || []).slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
  const triggered  = allResults.filter(r => r.triggered === 'yes' || r.triggered === 'partial')
  const orderedPriority = triggered
    .slice()
    .sort((a, b) => {
      const order = { 'primary': 0, 'co-primary': 1, 'excess': 2, 'sub-excess': 3 }
      return (order[a.priority_rank] ?? 99) - (order[b.priority_rank] ?? 99)
    })
  const govState = analysis.governing_state || matter.governing_state || '(governing state not specified)'

  // ── Header meta table (TO/FROM/RE/Governing law)
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [metaCell('DATE:',           todayLong())] }),
      new TableRow({ children: [metaCell('TO:',             organization?.name || 'File')] }),
      new TableRow({ children: [metaCell('FROM:',           'LexClause Coverage Priority Engine')] }),
      new TableRow({ children: [metaCell('RE:',             matter.name || '(unnamed matter)')] }),
      new TableRow({ children: [metaCell('GOVERNING LAW:',  govState)] }),
      new TableRow({ children: [metaCell('SUBJECT:',        'Coverage Priority Opinion — Trigger, Priority, Exhaustion')] }),
    ],
  })

  // ── Trigger summary table
  const triggerTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        tdHead('Carrier', 30),
        tdHead('Policy #', 18),
        tdHead('Form', 18),
        tdHead('Period', 20),
        tdHead('Trigger', 14),
      ] }),
      ...allResults.map(r => new TableRow({ children: [
        td(r.carrier || '—'),
        td(r.policy_number || '—'),
        td(cap(r.policy_form) || '—'),
        td(`${r.policy_effective || ''} – ${r.policy_expiration || ''}`),
        td(triggeredLabel(r.triggered), {
          bold: true, align: AlignmentType.CENTER,
          color: r.triggered === 'yes' ? EMERALD_HEX : r.triggered === 'partial' ? AMBER_HEX : SOFT_HEX,
        }),
      ] })),
    ],
  })

  // ── Per-policy trigger blocks (detailed)
  const triggerBlocks = []
  for (const r of allResults) {
    triggerBlocks.push(H(`${r.carrier || '—'} — ${triggeredLabel(r.triggered)}`, HeadingLevel.HEADING_3))
    triggerBlocks.push(P(
      `Policy ${r.policy_number || '—'}  ·  ${cap(r.policy_form) || '—'}  ·  ${r.policy_effective || ''} – ${r.policy_expiration || ''}  ·  Issued in ${r.policy_state_issued || '—'}`,
      { color: MID_HEX, size: 20 },
    ))
    if (r.coverage_grant_basis) {
      triggerBlocks.push(P('Coverage grant: ' + r.coverage_grant_basis, { italics: true, color: SOFT_HEX, size: 20 }))
    }
    const allegs = asArray(r.allegations_implicating_coverage)
    if (allegs.length) {
      triggerBlocks.push(P('Implicating allegations:', { bold: true, color: MID_HEX, size: 20 }))
      for (const a of allegs) {
        triggerBlocks.push(P('• ' + a, { size: 20, color: DARK_HEX }))
      }
    }
    const exclusions = asArray(r.exclusions_considered)
    if (exclusions.length) {
      triggerBlocks.push(P('Exclusions considered:', { bold: true, color: MID_HEX, size: 20 }))
      for (const e of exclusions) {
        const head = `• ${e.label || 'Unlabelled exclusion'} — ${e.applies ? 'BARS' : 'does not bar'}`
        triggerBlocks.push(P(head, { size: 20, color: e.applies ? AMBER_HEX : DARK_HEX, bold: !!e.applies }))
        if (e.rationale) triggerBlocks.push(P('   ' + e.rationale, { size: 20, color: SOFT_HEX, italics: true }))
      }
    }
    if (r.trigger_rationale) {
      triggerBlocks.push(P(r.trigger_rationale, { size: 22 }))
    }
  }

  // ── Priority blocks
  const priorityBlocks = []
  if (orderedPriority.length === 0) {
    priorityBlocks.push(P('No policies are triggered. The priority analysis is therefore inapplicable.', { size: 22, italics: true }))
  } else {
    for (const r of orderedPriority) {
      priorityBlocks.push(H(`${r.carrier || '—'} — ${rankLabel(r.priority_rank).toUpperCase()}`, HeadingLevel.HEADING_3))
      priorityBlocks.push(P(`Policy ${r.policy_number || '—'}  ·  ${cap(r.policy_form) || '—'}`, { color: MID_HEX, size: 20 }))
      if (r.priority_rank_basis) priorityBlocks.push(P(r.priority_rank_basis, { size: 22 }))
      if (r.other_insurance_quote) {
        priorityBlocks.push(P('Other Insurance language: "' + r.other_insurance_quote + '"', { italics: true, color: SOFT_HEX, size: 20 }))
      }
    }
  }
  if (analysis.priority_rule_applied) {
    priorityBlocks.push(P('Controlling rule:', { bold: true, color: MID_HEX, size: 20, spacing: { before: 200 } }))
    priorityBlocks.push(P(analysis.priority_rule_applied, { size: 22 }))
    if (analysis.priority_rule_citation) {
      priorityBlocks.push(P(analysis.priority_rule_citation, { italics: true, color: BRAND_HEX, size: 20 }))
    }
  }
  const mrGroups = asArray(analysis.mutually_repugnant_groups)
  if (mrGroups.length) {
    priorityBlocks.push(P('Mutually-repugnant groups:', { bold: true, color: MID_HEX, size: 20, spacing: { before: 200 } }))
    for (const g of mrGroups) {
      if (g.reason) priorityBlocks.push(P('• ' + g.reason, { size: 22 }))
      if (g.default_rule) priorityBlocks.push(P('   → default rule: ' + g.default_rule, { size: 20, italics: true, color: SOFT_HEX }))
    }
  }

  // ── Exhaustion block
  const exhaustionBlocks = []
  const exhaustRule = analysis.exhaustion_rule || 'undetermined'
  exhaustionBlocks.push(P(`Rule: ${exhaustRule.toUpperCase()}`, { bold: true, color: BRAND_HEX, size: 22 }))
  const exhaustRationale = analysis.raw_engine_output?.exhaustion_analysis?.rationale
  if (exhaustRationale) exhaustionBlocks.push(P(exhaustRationale, { size: 22 }))
  if (analysis.exhaustion_rule_citation) {
    exhaustionBlocks.push(P(analysis.exhaustion_rule_citation, { italics: true, color: BRAND_HEX, size: 20 }))
  }

  // ── Validation note
  const validationParas = []
  if (analysis.validation_status === 'needs_review') {
    validationParas.push(P(`This opinion was flagged for human review — the engine could not fully reconcile its structural invariants after ${analysis.validation_attempts || 1} attempt(s). Treat the below as a draft and verify before relying on it.`, { color: AMBER_HEX, bold: true, size: 22 }))
    for (const e of asArray(analysis.validation_errors)) {
      validationParas.push(P('• ' + (e.message || ''), { color: AMBER_HEX, size: 20 }))
    }
  }

  // ── Build the document
  const doc = new Document({
    creator:     'LexClause',
    title:       `Coverage Opinion — ${matter.name || 'Matter'}`,
    description: 'Coverage priority opinion (Trigger / Priority / Exhaustion)',
    styles: {
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
          run:       { font: 'Calibri', size: 28, bold: true, color: DARK_HEX },
          paragraph: { spacing: { before: 320, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
          run:       { font: 'Calibri', size: 24, bold: true, color: DARK_HEX },
          paragraph: { spacing: { before: 240, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
          run:       { font: 'Calibri', size: 22, bold: true, color: BRAND_HEX },
          paragraph: { spacing: { before: 200, after: 80 } } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 900, left: 720 } } },
      headers: {
        default: new Header({ children: [
          new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'LEXCLAUSE  ·  COVERAGE PRIORITY OPINION', font: 'Calibri', size: 18, color: BRAND_HEX, bold: true })] }),
        ] }),
      },
      footers: {
        default: new Footer({ children: [
          new Paragraph({ alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: FAINT_HEX }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: FAINT_HEX }),
              new TextRun({ text: ' of ',  font: 'Calibri', size: 18, color: FAINT_HEX }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18, color: FAINT_HEX }),
            ] }),
        ] }),
      },
      children: [
        // ── Title block
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 80 },
          children: [new TextRun({ text: 'COVERAGE OPINION', bold: true, font: 'Calibri', size: 40, color: DARK_HEX })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 },
          children: [new TextRun({ text: 'Trigger  ·  Priority  ·  Exhaustion', italics: true, font: 'Calibri', size: 24, color: BRAND_HEX })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: `Under the law of ${govState}`, italics: true, font: 'Calibri', size: 22, color: SOFT_HEX })] }),

        metaTable,
        new Paragraph({ spacing: { before: 120, after: 120 } }),

        ...validationParas,

        // ── I. Executive Summary
        H('I. Executive Summary', HeadingLevel.HEADING_1),
        P(buildExecutiveSummary({ analysis, matter, govState, allResults, triggered, orderedPriority }), { size: 22 }),

        // Trigger summary table
        new Paragraph({ spacing: { before: 120, after: 120 } }),
        triggerTable,
        new Paragraph({ spacing: { before: 120, after: 120 } }),

        // ── II. Trigger / Duty to Defend
        H('II. Trigger / Duty to Defend', HeadingLevel.HEADING_1),
        P(`The duty-to-defend analysis applies ${govState}'s controlling test to each policy. Each entry below names the implicating allegations and the specific coverage grant or exclusion that drives the answer.`, { size: 22 }),
        ...triggerBlocks,

        // ── III. Priority of Coverage
        H('III. Priority of Coverage', HeadingLevel.HEADING_1),
        ...priorityBlocks,

        // ── IV. Exhaustion
        H('IV. Exhaustion', HeadingLevel.HEADING_1),
        ...exhaustionBlocks,

        // ── V. Opinion Summary
        ...(analysis.narrative ? [
          H('V. Opinion Summary', HeadingLevel.HEADING_1),
          ...String(analysis.narrative).split(/\n\n+/).map(t => P(t.trim(), { size: 22 })),
        ] : []),

        // ── Disclaimer
        new Paragraph({ spacing: { before: 360, after: 60 },
          children: [new TextRun({ text: 'DISCLAIMER', bold: true, font: 'Calibri', size: 18, color: FAINT_HEX })] }),
        new Paragraph({ spacing: { after: 60 },
          children: [new TextRun({
            text: `This opinion was generated by LexClause's coverage-priority engine on ${todayLong()}. Citations are pulled from a curated state-supreme-court catalog; the engine is forbidden from fabricating authority. This is draft work product to assist coverage counsel — it is not legal advice and does not substitute for independent professional judgment. Verify all citations and conclusions before relying on them, especially in jurisdictions where coverage law has shifted recently.`,
            font: 'Calibri', size: 18, italics: true, color: SOFT_HEX,
          })] }),
      ],
    }],
  })

  return await Packer.toBlob(doc)
}

function buildExecutiveSummary({ analysis, matter, govState, allResults, triggered, orderedPriority }) {
  const total = allResults.length
  const tCount = triggered.length
  const primaries = orderedPriority.filter(r => r.priority_rank === 'primary' || r.priority_rank === 'co-primary')
  const excessLayers = orderedPriority.filter(r => r.priority_rank === 'excess' || r.priority_rank === 'sub-excess')
  const exhaust = analysis.exhaustion_rule || 'undetermined'

  const primaryNames = primaries.map(p => p.carrier).filter(Boolean).join(', ') || 'none'
  const excessNames  = excessLayers.map(p => p.carrier).filter(Boolean).join(', ') || 'none'

  return `This opinion analyzes ${total} polic${total === 1 ? 'y' : 'ies'} attached to ${matter.name || 'the matter'} under the law of ${govState}. ${tCount === 0 ? 'No policy is triggered by the underlying allegations.' : `${tCount} polic${tCount === 1 ? 'y is' : 'ies are'} triggered.`} ${primaryNames === 'none' ? '' : `Primary responsibility falls on ${primaryNames}.`} ${excessNames === 'none' ? '' : `Excess responsibility falls on ${excessNames}.`} The controlling exhaustion rule is ${exhaust.toUpperCase()}.`
}

export async function downloadMemoDocx(input) {
  const blob = await buildMemoDocx(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `LexClause_Opinion_${safeFilename(input.matter.name)}.docx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PDF generation ──────────────────────────────────────────────────────────
function pdfHeader(doc, matter) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, w, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BRAND)
  doc.text('LEXCLAUSE  ·  COVERAGE PRIORITY OPINION', w - 14, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text((matter.name || '').slice(0, 80), 14, 14)
}
function pdfFooter(doc) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const page = doc.internal.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...FAINT)
  doc.text(`Page ${page}`, w / 2, h - 8, { align: 'center' })
}

export function buildMemoPdf({ analysis, matter, results, organization }) {
  const allResults = (results || []).slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
  const triggered  = allResults.filter(r => r.triggered === 'yes' || r.triggered === 'partial')
  const orderedPriority = triggered
    .slice()
    .sort((a, b) => {
      const order = { 'primary': 0, 'co-primary': 1, 'excess': 2, 'sub-excess': 3 }
      return (order[a.priority_rank] ?? 99) - (order[b.priority_rank] ?? 99)
    })
  const govState = analysis.governing_state || matter.governing_state || '(governing state not specified)'

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 54
  let y = 72

  pdfHeader(doc, matter)

  // Title block
  doc.setFont('helvetica', 'bold'); doc.setFontSize(24); doc.setTextColor(...DARK)
  doc.text('COVERAGE OPINION', pageW / 2, y, { align: 'center' })
  y += 18
  doc.setFont('helvetica', 'italic'); doc.setFontSize(13); doc.setTextColor(...BRAND)
  doc.text('Trigger  ·  Priority  ·  Exhaustion', pageW / 2, y, { align: 'center' })
  y += 14
  doc.setFont('helvetica', 'italic'); doc.setFontSize(11); doc.setTextColor(...SOFT)
  doc.text(`Under the law of ${govState}`, pageW / 2, y, { align: 'center' })
  y += 24

  // Meta block
  const meta = [
    ['DATE:',          todayLong()],
    ['TO:',            organization?.name || 'File'],
    ['FROM:',          'LexClause Coverage Priority Engine'],
    ['RE:',            matter.name || '(unnamed matter)'],
    ['GOVERNING LAW:', govState],
    ['SUBJECT:',       'Coverage Priority Opinion — Trigger, Priority, Exhaustion'],
  ]
  doc.setFontSize(10)
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...MID); doc.text(k, margin, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK); doc.text(String(v || ''), margin + 100, y, { maxWidth: pageW - margin*2 - 100 })
    y += 14
  }
  y += 8

  // Validation banner
  if (analysis.validation_status === 'needs_review') {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AMBER)
    const text = `Flagged for human review — engine could not fully reconcile after ${analysis.validation_attempts || 1} attempt(s). Treat as draft.`
    const lines = doc.splitTextToSize(text, pageW - margin*2)
    doc.text(lines, margin, y); y += lines.length * 12 + 6
  }

  // I. Executive Summary
  const renderSection = (title, paras = [], opts = {}) => {
    if (y > 700) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
    doc.text(title, margin, y); y += 6
    doc.setDrawColor(...BRAND); doc.setLineWidth(1.2)
    doc.line(margin, y, margin + 90, y); y += 12
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
    for (const p of paras) {
      const wrapped = doc.splitTextToSize(p, pageW - margin*2)
      for (const line of wrapped) {
        if (y > 740) { doc.addPage(); y = 80 }
        doc.text(line, margin, y); y += 12
      }
      y += 6
    }
    y += 6
  }

  renderSection('I. Executive Summary', [
    `This opinion analyzes ${allResults.length} polic${allResults.length === 1 ? 'y' : 'ies'} attached to ${matter.name || 'the matter'} under the law of ${govState}.`,
    `${triggered.length === 0 ? 'No policy is triggered by the underlying allegations.' : `${triggered.length} polic${triggered.length === 1 ? 'y is' : 'ies are'} triggered.`}`
      + (orderedPriority.length ? ` Priority order: ${orderedPriority.map(r => `${r.carrier} (${rankLabel(r.priority_rank)})`).join('; ')}.` : '')
      + ` Exhaustion: ${(analysis.exhaustion_rule || 'undetermined').toUpperCase()}.`,
  ])

  // Trigger summary table
  autoTable(doc, {
    startY: y,
    head: [['Carrier', 'Policy #', 'Form', 'Period', 'Trigger']],
    body: allResults.map(r => [
      r.carrier || '—',
      r.policy_number || '—',
      cap(r.policy_form) || '—',
      `${r.policy_effective || ''} – ${r.policy_expiration || ''}`,
      {
        content: triggeredLabel(r.triggered),
        styles: {
          fontStyle: 'bold',
          textColor: r.triggered === 'yes' ? EMERALD : r.triggered === 'partial' ? AMBER : SOFT,
          halign: 'center',
        },
      },
    ]),
    headStyles: { fillColor: BRAND_LIGHT, textColor: MID, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { textColor: DARK, fontSize: 9 },
    margin: { left: margin, right: margin },
    didDrawPage: () => { pdfHeader(doc, matter); pdfFooter(doc) },
  })
  y = doc.lastAutoTable.finalY + 18

  // II. Trigger detailed
  renderSection('II. Trigger / Duty to Defend',
    [`The duty-to-defend analysis applies ${govState}'s controlling test to each policy. Each entry names the implicating allegations and the specific coverage grant or exclusion that drives the answer.`])

  for (const r of allResults) {
    if (y > 680) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BRAND)
    doc.text(`${r.carrier || '—'} — ${triggeredLabel(r.triggered)}`, margin, y); y += 13
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
    doc.text(doc.splitTextToSize(`Policy ${r.policy_number || '—'}  ·  ${cap(r.policy_form) || '—'}  ·  ${r.policy_effective || ''} – ${r.policy_expiration || ''}  ·  Issued in ${r.policy_state_issued || '—'}`, pageW - margin*2), margin, y); y += 12

    if (r.coverage_grant_basis) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...SOFT)
      const lines = doc.splitTextToSize('Coverage grant: ' + r.coverage_grant_basis, pageW - margin*2)
      for (const ln of lines) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 11 }
      y += 2
    }

    const allegs = asArray(r.allegations_implicating_coverage)
    if (allegs.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MID)
      doc.text('Implicating allegations:', margin, y); y += 12
      doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK)
      for (const a of allegs) {
        const lines = doc.splitTextToSize('• ' + a, pageW - margin*2 - 8)
        for (const ln of lines) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin + 8, y); y += 11 }
      }
      y += 2
    }

    const exclusions = asArray(r.exclusions_considered)
    if (exclusions.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MID)
      doc.text('Exclusions considered:', margin, y); y += 12
      for (const e of exclusions) {
        const head = `• ${e.label || 'Unlabelled exclusion'} — ${e.applies ? 'BARS' : 'does not bar'}`
        doc.setFont('helvetica', e.applies ? 'bold' : 'normal'); doc.setTextColor(...(e.applies ? AMBER : DARK))
        const headLines = doc.splitTextToSize(head, pageW - margin*2 - 8)
        for (const ln of headLines) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin + 8, y); y += 11 }
        if (e.rationale) {
          doc.setFont('helvetica', 'italic'); doc.setTextColor(...SOFT)
          const rl = doc.splitTextToSize('   ' + e.rationale, pageW - margin*2 - 16)
          for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin + 16, y); y += 11 }
        }
      }
      y += 2
    }

    if (r.trigger_rationale) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
      const rl = doc.splitTextToSize(r.trigger_rationale, pageW - margin*2)
      for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 12 }
    }
    y += 10
  }

  // III. Priority
  renderSection('III. Priority of Coverage', [])
  if (orderedPriority.length === 0) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...SOFT)
    doc.text('No policies are triggered. Priority analysis inapplicable.', margin, y); y += 14
  } else {
    for (const r of orderedPriority) {
      if (y > 680) { doc.addPage(); y = 80 }
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BRAND)
      doc.text(`${r.carrier || '—'} — ${rankLabel(r.priority_rank).toUpperCase()}`, margin, y); y += 13
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
      doc.text(`Policy ${r.policy_number || '—'}  ·  ${cap(r.policy_form) || '—'}`, margin, y); y += 12
      if (r.priority_rank_basis) {
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
        const rl = doc.splitTextToSize(r.priority_rank_basis, pageW - margin*2)
        for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 12 }
      }
      if (r.other_insurance_quote) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...SOFT)
        const ql = doc.splitTextToSize('Other Insurance: "' + r.other_insurance_quote + '"', pageW - margin*2)
        for (const ln of ql) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 11 }
      }
      y += 8
    }
  }

  if (analysis.priority_rule_applied) {
    if (y > 680) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...MID)
    doc.text('Controlling rule:', margin, y); y += 12
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
    const rl = doc.splitTextToSize(analysis.priority_rule_applied, pageW - margin*2)
    for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 12 }
    if (analysis.priority_rule_citation) {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...BRAND)
      const cl = doc.splitTextToSize(analysis.priority_rule_citation, pageW - margin*2)
      for (const ln of cl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 11 }
    }
    y += 8
  }

  const mrGroups = asArray(analysis.mutually_repugnant_groups)
  if (mrGroups.length) {
    if (y > 680) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...MID)
    doc.text('Mutually-repugnant groups:', margin, y); y += 12
    for (const g of mrGroups) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
      if (g.reason) {
        const rl = doc.splitTextToSize('• ' + g.reason, pageW - margin*2)
        for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 12 }
      }
      if (g.default_rule) {
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...SOFT)
        const rl = doc.splitTextToSize('   → default rule: ' + g.default_rule, pageW - margin*2 - 10)
        for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin + 10, y); y += 11 }
      }
    }
    y += 8
  }

  // IV. Exhaustion
  renderSection('IV. Exhaustion', [])
  doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...BRAND)
  doc.text(`Rule: ${(analysis.exhaustion_rule || 'undetermined').toUpperCase()}`, margin, y); y += 14
  const exhaustRationale = analysis.raw_engine_output?.exhaustion_analysis?.rationale
  if (exhaustRationale) {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
    const rl = doc.splitTextToSize(exhaustRationale, pageW - margin*2)
    for (const ln of rl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 12 }
  }
  if (analysis.exhaustion_rule_citation) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...BRAND)
    const cl = doc.splitTextToSize(analysis.exhaustion_rule_citation, pageW - margin*2)
    for (const ln of cl) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 11 }
  }
  y += 12

  // V. Opinion Summary
  if (analysis.narrative) {
    renderSection('V. Opinion Summary', String(analysis.narrative).split(/\n\n+/).map(s => s.trim()).filter(Boolean))
  }

  // Disclaimer
  if (y > 700) { doc.addPage(); y = 80 }
  y += 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(...FAINT)
  doc.text('DISCLAIMER', margin, y); y += 10
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...SOFT)
  const disc = `This opinion was generated by LexClause's coverage-priority engine on ${todayLong()}. Citations are pulled from a curated state-supreme-court catalog; the engine is forbidden from fabricating authority. This is draft work product to assist coverage counsel — it is not legal advice and does not substitute for independent professional judgment. Verify all citations and conclusions before relying on them, especially in jurisdictions where coverage law has shifted recently.`
  doc.text(doc.splitTextToSize(disc, pageW - margin*2), margin, y)

  pdfFooter(doc)
  return doc
}

export function downloadMemoPdf(input) {
  const doc = buildMemoPdf(input)
  doc.save(`LexClause_Opinion_${safeFilename(input.matter.name)}.pdf`)
}
