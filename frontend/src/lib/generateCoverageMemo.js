// generateCoverageMemo.js
//
// Produces a professional coverage-allocation memo from a completed analysis.
// Two formats: .docx (attorney-editable) and .pdf (finalized).
//
// Usage:
//   import { downloadMemoDocx, downloadMemoPdf } from '../lib/generateCoverageMemo.js'
//   await downloadMemoDocx({ analysis, matter, results, organization })
//
// Inputs:
//   analysis      — row from lc_analyses
//   matter        — row from lc_matters
//   results       — array from lc_analysis_results (sorted by ordering)
//   organization  — { name } from lc_organizations (optional)

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType,
  PageBreak, PageNumber, Header, Footer,
} from 'docx'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Formatting helpers ──────────────────────────────────────────────────────
function fmtMoney(n) {
  if (n == null || n === '') return '—'
  return `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
function fmtPct(n) {
  if (n == null) return '—'
  return `${(Number(n) * 100).toFixed(2)}%`
}
function cap(s) {
  if (!s) return '—'
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
function todayLong() {
  return new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}
function safeFilename(s) {
  return String(s || 'matter').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80)
}
function sortByLayer(rows) {
  const order = { primary: 0, umbrella: 1, excess: 2, self_insured: 3 }
  return [...rows].sort((a, b) => {
    const la = order[a.layer] ?? 99, lb = order[b.layer] ?? 99
    if (la !== lb) return la - lb
    return (a.attachment_point || 0) - (b.attachment_point || 0)
  })
}

// ── DOCX generation ────────────────────────────────────────────────────────
function P(text, opts = {}) {
  return new Paragraph({
    spacing: { after: 120, ...(opts.spacing || {}) },
    alignment: opts.alignment || AlignmentType.LEFT,
    children: [new TextRun({ text: text || '', bold: !!opts.bold, italics: !!opts.italics, color: opts.color, size: opts.size, font: 'Calibri' })],
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
  top:    { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  left:   { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
  right:  { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' },
}

function metaCell(label, value) {
  return new TableCell({
    borders: NO_BORDER,
    margins: { top: 60, bottom: 60, left: 0, right: 200 },
    children: [
      new Paragraph({ children: [
        new TextRun({ text: label, bold: true, font: 'Calibri', size: 22, color: '475569' }),
        new TextRun({ text: '\t' + (value || '—'), font: 'Calibri', size: 22, color: '0F172A' }),
      ] }),
    ],
  })
}
function tdHead(text, width) {
  return new TableCell({
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: THIN_BORDER,
    shading: { type: ShadingType.SOLID, color: 'F1F5F9', fill: 'F1F5F9' },
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, font: 'Calibri', size: 18, color: '475569' })] })],
  })
}
function td(text, opts = {}) {
  return new TableCell({
    borders: THIN_BORDER,
    margins: { top: 80, bottom: 80, left: 100, right: 100 },
    children: [new Paragraph({
      alignment: opts.align || AlignmentType.LEFT,
      children: [new TextRun({ text: String(text ?? ''), bold: !!opts.bold, font: 'Calibri', size: 20, color: opts.color || '0F172A' })],
    })],
  })
}

export async function buildMemoDocx({ analysis, matter, results, organization }) {
  const sortedResults = sortByLayer(results || [])
  const exposure = Number(matter.damages_exposure || 0)
  const carrierTotal = sortedResults.reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
  const insuredRetention = Number(analysis.insured_retention || 0)
  const grandTotal = carrierTotal + insuredRetention

  // ── Header table (TO/FROM/RE)
  const metaTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ children: [metaCell('DATE:', todayLong())] }),
      new TableRow({ children: [metaCell('TO:',   organization?.name || 'File')] }),
      new TableRow({ children: [metaCell('FROM:', 'LexClause Coverage Analysis Engine')] }),
      new TableRow({ children: [metaCell('RE:',   matter.name)] }),
      new TableRow({ children: [metaCell('',      'Coverage Allocation Analysis')] }),
    ],
  })

  // ── Executive summary table
  const allocTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({ tableHeader: true, children: [
        tdHead('Carrier', 35),
        tdHead('Policy #', 17),
        tdHead('Layer', 11),
        tdHead('Period', 17),
        tdHead('Share', 8),
        tdHead('Allocated', 12),
      ] }),
      ...sortedResults.map(r => new TableRow({ children: [
        td(r.carrier || '—'),
        td(r.policy_number || '—'),
        td(cap(r.layer)),
        td(`${r.policy_effective || ''} – ${r.policy_expiration || ''}`),
        td(fmtPct(r.share_pct), { align: AlignmentType.RIGHT }),
        td(fmtMoney(r.allocated_amount), { align: AlignmentType.RIGHT, bold: true }),
      ] })),
      ...(insuredRetention > 0 ? [new TableRow({ children: [
        td('Insured Retention'),
        td('—'),
        td('SIR'),
        td('—'),
        td(fmtPct(insuredRetention / exposure), { align: AlignmentType.RIGHT }),
        td(fmtMoney(insuredRetention), { align: AlignmentType.RIGHT, bold: true }),
      ] })] : []),
      new TableRow({ children: [
        new TableCell({
          columnSpan: 5, borders: THIN_BORDER,
          shading: { type: ShadingType.SOLID, color: 'F1F5F9', fill: 'F1F5F9' },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: 'TOTAL', bold: true, font: 'Calibri', size: 20 })] })],
        }),
        new TableCell({
          borders: THIN_BORDER,
          shading: { type: ShadingType.SOLID, color: 'F1F5F9', fill: 'F1F5F9' },
          margins: { top: 80, bottom: 80, left: 100, right: 100 },
          children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: fmtMoney(grandTotal), bold: true, font: 'Calibri', size: 20 })] })],
        }),
      ] }),
    ],
  })

  // ── Per-carrier analysis blocks
  const perCarrierBlocks = []
  for (const r of sortedResults) {
    perCarrierBlocks.push(H(`${r.carrier} — ${cap(r.layer)}`, HeadingLevel.HEADING_3))
    perCarrierBlocks.push(P(`Policy: ${r.policy_number || '—'}    |    Period: ${r.policy_effective || ''} – ${r.policy_expiration || ''}    |    Issued in: ${r.policy_state_issued || '—'}`, { color: '475569', size: 20 }))
    perCarrierBlocks.push(P(`Layer: ${cap(r.layer)}    |    Attachment: ${fmtMoney(r.attachment_point || 0)}    |    Limit: ${fmtMoney(r.applicable_limit)}    |    Allocated: ${fmtMoney(r.allocated_amount)} (${fmtPct(r.share_pct)})`, { color: '475569', size: 20 }))
    if (r.rationale) perCarrierBlocks.push(P(r.rationale, { size: 22 }))
  }

  // ── Reconciliation block
  const reconParas = []
  if (analysis.validation_status === 'valid') {
    reconParas.push(P(`This allocation reconciles to the matter's ${fmtMoney(exposure)} damages exposure exactly. All per-carrier amounts are within their applicable limits.${analysis.validation_attempts > 1 ? ` (Auto-corrected after ${analysis.validation_attempts} attempts.)` : ''}`))
  } else if (analysis.validation_status === 'needs_review') {
    reconParas.push(P(`This allocation did not fully reconcile after ${analysis.validation_attempts || 1} attempt(s). Review the per-carrier amounts before relying on these numbers.`, { color: 'B45309' }))
    if (Array.isArray(analysis.validation_errors)) {
      for (const e of analysis.validation_errors) {
        reconParas.push(P(`• ${e.message}`, { color: 'B45309', size: 20 }))
      }
    }
  }

  // ── Build the document
  const doc = new Document({
    creator: 'LexClause',
    title: `Coverage Memo — ${matter.name}`,
    description: 'Coverage allocation analysis',
    styles: {
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal',
          run: { font: 'Calibri', size: 28, bold: true, color: '0F172A' },
          paragraph: { spacing: { before: 280, after: 120 } } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal',
          run: { font: 'Calibri', size: 24, bold: true, color: '0F172A' },
          paragraph: { spacing: { before: 240, after: 100 } } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal',
          run: { font: 'Calibri', size: 22, bold: true, color: '0F766E' },
          paragraph: { spacing: { before: 200, after: 80 } } },
      ],
    },
    sections: [{
      properties: { page: { margin: { top: 720, right: 720, bottom: 900, left: 720 } } },
      headers: {
        default: new Header({ children: [
          new Paragraph({ alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: 'LEXCLAUSE COVERAGE MEMO', font: 'Calibri', size: 18, color: '0F766E', bold: true })] }),
        ] }),
      },
      footers: {
        default: new Footer({ children: [
          new Paragraph({ alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: 'Page ', font: 'Calibri', size: 18, color: '94A3B8' }),
              new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 18, color: '94A3B8' }),
              new TextRun({ text: ' of ', font: 'Calibri', size: 18, color: '94A3B8' }),
              new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 18, color: '94A3B8' }),
            ] }),
        ] }),
      },
      children: [
        // Title
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 },
          children: [new TextRun({ text: 'MEMORANDUM', bold: true, font: 'Calibri', size: 36, color: '0F172A' })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 240 },
          children: [new TextRun({ text: 'Coverage Allocation Analysis', italics: true, font: 'Calibri', size: 24, color: '64748B' })] }),

        metaTable,
        new Paragraph({ spacing: { before: 120, after: 120 } }),

        // I. Executive Summary
        H('I. Executive Summary', HeadingLevel.HEADING_1),
        P(`This memorandum allocates the ${fmtMoney(exposure)} damages exposure on ${matter.name} across the policies attached to this matter. Under the law of ${matter.governing_state || '(governing state not specified)'}, the controlling allocation method is "${cap(analysis.allocation_method)}" applied to a "${cap(analysis.trigger_theory)}" trigger.`, { size: 22 }),
        new Paragraph({ spacing: { before: 120, after: 120 } }),
        allocTable,
        new Paragraph({ spacing: { before: 120, after: 120 } }),

        // II. Tower Structure
        ...(analysis.tower_explanation ? [
          H('II. Tower Structure', HeadingLevel.HEADING_1),
          P(analysis.tower_explanation, { size: 22 }),
        ] : []),

        // III. Methodology
        H('III. Methodology', HeadingLevel.HEADING_1),
        ...(String(analysis.methodology_text || 'No methodology generated.')
          .split(/\n\n+/)
          .map(t => P(t.trim(), { size: 22 }))),

        // IV. Per-Carrier Analysis
        H('IV. Per-Carrier Analysis', HeadingLevel.HEADING_1),
        ...perCarrierBlocks,

        // V. Reconciliation
        H('V. Reconciliation', HeadingLevel.HEADING_1),
        ...reconParas,

        // Disclaimer
        new Paragraph({ spacing: { before: 360, after: 60 },
          children: [new TextRun({ text: 'DISCLAIMER', bold: true, font: 'Calibri', size: 18, color: '94A3B8' })] }),
        new Paragraph({ spacing: { after: 60 },
          children: [new TextRun({ text: `This memorandum was generated by LexClause's coverage allocation engine on ${todayLong()}. It is a draft work product to assist coverage counsel; it is not legal advice and does not substitute for independent professional judgment. All citations, policy interpretations, and allocations should be independently verified before being relied upon. State law evolves — confirm current authority.`, font: 'Calibri', size: 18, italics: true, color: '64748B' })] }),
      ],
    }],
  })

  return await Packer.toBlob(doc)
}

export async function downloadMemoDocx(input) {
  const blob = await buildMemoDocx(input)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `LexClause_Memo_${safeFilename(input.matter.name)}.docx`
  document.body.appendChild(a); a.click(); document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// ── PDF generation ─────────────────────────────────────────────────────────
const TEAL  = [13, 148, 136]
const DARK  = [15, 23, 42]
const MID   = [71, 85, 105]
const LIGHT = [241, 245, 249]
const AMBER = [180, 83, 9]

function pdfHeader(doc, matter) {
  const w = doc.internal.pageSize.getWidth()
  doc.setFillColor(...TEAL)
  doc.rect(0, 0, w, 6, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEAL)
  doc.text('LEXCLAUSE COVERAGE MEMO', w - 14, 14, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...MID)
  doc.text(matter.name?.slice(0, 80) || '', 14, 14)
}
function pdfFooter(doc) {
  const w = doc.internal.pageSize.getWidth()
  const h = doc.internal.pageSize.getHeight()
  const page = doc.internal.getNumberOfPages()
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(148, 163, 184)
  doc.text(`Page ${page}`, w / 2, h - 8, { align: 'center' })
}

export function buildMemoPdf({ analysis, matter, results, organization }) {
  const sortedResults = sortByLayer(results || [])
  const exposure = Number(matter.damages_exposure || 0)
  const carrierTotal = sortedResults.reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
  const insuredRetention = Number(analysis.insured_retention || 0)
  const grandTotal = carrierTotal + insuredRetention

  const doc = new jsPDF({ unit: 'pt', format: 'letter' })
  const pageW = doc.internal.pageSize.getWidth()
  const margin = 54
  let y = 54

  pdfHeader(doc, matter)

  // Title
  y = 72
  doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...DARK)
  doc.text('MEMORANDUM', pageW / 2, y, { align: 'center' })
  y += 18
  doc.setFont('helvetica', 'italic'); doc.setFontSize(12); doc.setTextColor(...MID)
  doc.text('Coverage Allocation Analysis', pageW / 2, y, { align: 'center' })
  y += 26

  // Meta block
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
  const meta = [
    ['DATE:',  todayLong()],
    ['TO:',    organization?.name || 'File'],
    ['FROM:',  'LexClause Coverage Analysis Engine'],
    ['RE:',    matter.name],
    ['',       'Coverage Allocation Analysis'],
  ]
  for (const [k, v] of meta) {
    doc.setFont('helvetica', 'bold');   doc.setTextColor(...MID);  doc.text(k, margin, y)
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...DARK); doc.text(String(v || ''), margin + 50, y, { maxWidth: pageW - margin*2 - 50 })
    y += 14
  }
  y += 10

  // I. Executive summary
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
  doc.text('I. Executive Summary', margin, y); y += 14
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
  const sumPara = `This memorandum allocates the ${fmtMoney(exposure)} damages exposure on ${matter.name} across the policies attached to this matter. Under the law of ${matter.governing_state || '(governing state not specified)'}, the controlling allocation method is "${cap(analysis.allocation_method)}" applied to a "${cap(analysis.trigger_theory)}" trigger.`
  const lines = doc.splitTextToSize(sumPara, pageW - margin*2)
  doc.text(lines, margin, y); y += lines.length * 12 + 8

  // Allocation table
  const tableBody = sortedResults.map(r => [
    r.carrier || '—',
    r.policy_number || '—',
    cap(r.layer),
    `${r.policy_effective || ''} – ${r.policy_expiration || ''}`,
    fmtPct(r.share_pct),
    fmtMoney(r.allocated_amount),
  ])
  if (insuredRetention > 0) {
    tableBody.push(['Insured Retention', '—', 'SIR', '—', fmtPct(insuredRetention / exposure), fmtMoney(insuredRetention)])
  }
  tableBody.push([{ content: 'TOTAL', colSpan: 5, styles: { halign: 'right', fontStyle: 'bold', fillColor: LIGHT } },
                  { content: fmtMoney(grandTotal), styles: { halign: 'right', fontStyle: 'bold', fillColor: LIGHT } }])

  autoTable(doc, {
    startY: y,
    head: [['Carrier', 'Policy #', 'Layer', 'Period', 'Share', 'Allocated']],
    body: tableBody,
    headStyles: { fillColor: LIGHT, textColor: MID, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { textColor: DARK, fontSize: 9 },
    columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
    margin: { left: margin, right: margin },
    didDrawPage: () => { pdfHeader(doc, matter); pdfFooter(doc) },
  })
  y = doc.lastAutoTable.finalY + 18

  // Helper to render a section that may overflow the page
  const renderSection = (title, paragraphs) => {
    if (y > 700) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
    doc.text(title, margin, y); y += 14
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
    for (const p of paragraphs) {
      const wrapped = doc.splitTextToSize(p, pageW - margin*2)
      // Page break if needed
      for (const line of wrapped) {
        if (y > 740) { doc.addPage(); y = 80 }
        doc.text(line, margin, y); y += 12
      }
      y += 6
    }
    y += 6
  }

  if (analysis.tower_explanation) renderSection('II. Tower Structure', [analysis.tower_explanation])
  renderSection('III. Methodology', String(analysis.methodology_text || 'No methodology generated.').split(/\n\n+/).map(s => s.trim()).filter(Boolean))

  // IV. Per-carrier analysis
  if (y > 680) { doc.addPage(); y = 80 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
  doc.text('IV. Per-Carrier Analysis', margin, y); y += 14
  for (const r of sortedResults) {
    if (y > 680) { doc.addPage(); y = 80 }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(13, 118, 110)
    doc.text(`${r.carrier} — ${cap(r.layer)}`, margin, y); y += 13
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MID)
    const meta1 = `Policy: ${r.policy_number || '—'}    |    Period: ${r.policy_effective || ''} – ${r.policy_expiration || ''}    |    Issued in: ${r.policy_state_issued || '—'}`
    const meta2 = `Layer: ${cap(r.layer)}    |    Attachment: ${fmtMoney(r.attachment_point || 0)}    |    Limit: ${fmtMoney(r.applicable_limit)}    |    Allocated: ${fmtMoney(r.allocated_amount)} (${fmtPct(r.share_pct)})`
    doc.text(doc.splitTextToSize(meta1, pageW - margin*2), margin, y); y += 11
    doc.text(doc.splitTextToSize(meta2, pageW - margin*2), margin, y); y += 13
    if (r.rationale) {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
      const ratLines = doc.splitTextToSize(r.rationale, pageW - margin*2)
      for (const line of ratLines) {
        if (y > 740) { doc.addPage(); y = 80 }
        doc.text(line, margin, y); y += 12
      }
    }
    y += 10
  }

  // V. Reconciliation
  if (y > 680) { doc.addPage(); y = 80 }
  doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(...DARK)
  doc.text('V. Reconciliation', margin, y); y += 14
  if (analysis.validation_status === 'valid') {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...DARK)
    const t = `This allocation reconciles to the matter's ${fmtMoney(exposure)} damages exposure exactly. All per-carrier amounts are within their applicable limits.${analysis.validation_attempts > 1 ? ` (Auto-corrected after ${analysis.validation_attempts} attempts.)` : ''}`
    doc.text(doc.splitTextToSize(t, pageW - margin*2), margin, y); y += 14
  } else if (analysis.validation_status === 'needs_review') {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...AMBER)
    doc.text(`Needs review — allocation did not fully reconcile after ${analysis.validation_attempts || 1} attempt(s).`, margin, y); y += 14
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...AMBER)
    for (const e of analysis.validation_errors || []) {
      const lines = doc.splitTextToSize(`• ${e.message}`, pageW - margin*2)
      for (const ln of lines) { if (y > 740) { doc.addPage(); y = 80 } doc.text(ln, margin, y); y += 11 }
      y += 4
    }
  }

  // Disclaimer
  if (y > 700) { doc.addPage(); y = 80 }
  y += 16
  doc.setFont('helvetica', 'bold'); doc.setFontSize(8); doc.setTextColor(148, 163, 184)
  doc.text('DISCLAIMER', margin, y); y += 10
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor(...MID)
  const disc = `This memorandum was generated by LexClause's coverage allocation engine on ${todayLong()}. It is a draft work product to assist coverage counsel; it is not legal advice and does not substitute for independent professional judgment. All citations, policy interpretations, and allocations should be independently verified before being relied upon. State law evolves — confirm current authority.`
  doc.text(doc.splitTextToSize(disc, pageW - margin*2), margin, y)

  // Apply footer to the final page
  pdfFooter(doc)

  return doc
}

export function downloadMemoPdf(input) {
  const doc = buildMemoPdf(input)
  doc.save(`LexClause_Memo_${safeFilename(input.matter.name)}.pdf`)
}
