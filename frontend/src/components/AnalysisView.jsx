/**
 * AnalysisView — shared result-rendering components for completed
 * coverage_priority analyses.
 *
 * Exports:
 *   <SingleStateResult analysis={…}    headerActions={…} />
 *   <ComparisonResult  comparison={[…]} headerActions={…} />
 *   <ExportMenu        payload={{ analysis, matter, results, organization }} />
 *
 * Used by:
 *   - Analyzer.jsx (live result after running an analysis)
 *   - Analysis.jsx (viewing a past analysis by id)
 *   - Comparison.jsx (viewing a past multi-state comparison by group id)
 */

import { useState, useRef, useEffect } from 'react'
import {
  AlertTriangle, CheckCircle2, X, Plus, ScrollText, Scale, Shield, Sparkles,
  Download, FileText, FileType, ChevronDown, Mail, Loader2, Send,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '../hooks/useAuth.jsx'
import { downloadMemoDocx, downloadMemoPdf, buildMemoDocx, buildMemoPdf } from '../lib/generateCoverageMemo.js'
import { emailOpinion } from '../lib/policyAnalysis.js'

// ──────────────────────────────────────────────────────────────────────────
// Single-state result
// ──────────────────────────────────────────────────────────────────────────
export function SingleStateResult({ analysis, headerActions }) {
  const { profile } = useAuth()
  const results = (analysis.lc_analysis_results || []).slice().sort((a, b) => (a.ordering ?? 0) - (b.ordering ?? 0))
  const triggered = results.filter(r => r.triggered === 'yes' || r.triggered === 'partial')
  const matterName = analysis.lc_matters?.name
  const matter = analysis.lc_matters || { name: matterName, governing_state: analysis.governing_state }
  const exportPayload = { analysis, matter, results, organization: profile?.organization }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* ── Header lockup ───────────────────────────────────────────────── */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <img
              src="/logo-icon.png"
              alt="LexClause"
              className="h-12 w-12 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1"
            />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">
                LexClause
              </span>
              <span className="text-xs text-slate-500 tracking-wide">Coverage priority opinion</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ExportMenu payload={exportPayload} />
            {headerActions}
          </div>
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Coverage Opinion</span>
        </h1>
      </header>

      {/* ── Hero strip ──────────────────────────────────────────────────── */}
      <div
        className="relative rounded-2xl overflow-hidden mb-8 border border-brand-200/60 shadow-card"
        style={{
          background:
            'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 45%, var(--brand-500) 100%)',
        }}
      >
        <div className="px-6 py-5 text-white">
          <div className="text-[11px] uppercase tracking-[0.18em] text-brand-100/90 font-semibold mb-1">
            Governing law
          </div>
          <div className="flex items-baseline gap-4 flex-wrap">
            <h2 className="font-serif-brand text-4xl tracking-tight leading-none">
              {analysis.governing_state}
            </h2>
            {matterName && (
              <p className="text-brand-50/95 text-base flex-1 min-w-0 truncate">{matterName}</p>
            )}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-wider">
            <span className="badge bg-white/15 text-white border border-white/20 backdrop-blur-sm">
              <ScrollText className="h-3 w-3 mr-1" /> {triggered.length} triggered
            </span>
            <span className="badge bg-white/15 text-white border border-white/20 backdrop-blur-sm">
              <Shield className="h-3 w-3 mr-1" /> {(analysis.exhaustion_rule || '—').toUpperCase()}
            </span>
            {analysis.validation_status === 'valid' && (
              <span className="badge bg-emerald-400/20 text-emerald-50 border border-emerald-300/40">
                <CheckCircle2 className="h-3 w-3 mr-1" /> Validated
              </span>
            )}
            {analysis.validation_status === 'needs_review' && (
              <span className="badge bg-amber-400/20 text-amber-50 border border-amber-300/40">
                <AlertTriangle className="h-3 w-3 mr-1" /> Needs review
              </span>
            )}
          </div>
        </div>
      </div>

      {analysis.validation_status === 'needs_review' && (
        <div className="card p-4 mb-6 border-amber-200 bg-amber-50/60">
          <div className="flex items-start gap-2 text-sm text-amber-900">
            <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>
              The engine flagged this opinion for human review (couldn't reconcile all invariants after{' '}
              {analysis.validation_attempts} attempts). Treat as a draft.
            </span>
          </div>
        </div>
      )}

      {/* Trigger */}
      <Section icon={<ScrollText className="h-5 w-5" />} title="Trigger / Duty to Defend" tag="01">
        <div className="space-y-3">
          {results.map(r => <TriggerCard key={r.id} r={r} />)}
        </div>
      </Section>

      {/* Priority */}
      <Section icon={<Scale className="h-5 w-5" />} title="Priority of Coverage" tag="02">
        {triggered.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No triggered policies.</p>
        ) : (
          <div className="space-y-3">
            {triggered.map(r => <PriorityCard key={r.id} r={r} />)}
          </div>
        )}
        {analysis.priority_rule_applied && (
          <div className="mt-4 pt-4 border-t border-brand-100">
            <p className="text-sm text-slate-700 leading-relaxed">{analysis.priority_rule_applied}</p>
            {analysis.priority_rule_citation && (
              <p className="text-xs text-brand-700 mt-2 italic font-medium">{analysis.priority_rule_citation}</p>
            )}
          </div>
        )}
        {Array.isArray(analysis.mutually_repugnant_groups) && analysis.mutually_repugnant_groups.length > 0 && (
          <div className="mt-4 pt-4 border-t border-brand-100">
            <h4 className="text-xs uppercase tracking-wider font-semibold text-brand-700 mb-2">
              Mutually-repugnant groups
            </h4>
            {analysis.mutually_repugnant_groups.map((g, i) => (
              <div key={i} className="text-sm text-slate-700 mb-2 pl-3 border-l-2 border-brand-300/70">
                <p>{g.reason}</p>
                <p className="text-slate-500 italic mt-1">→ default rule: {g.default_rule}</p>
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* Exhaustion */}
      <Section icon={<Shield className="h-5 w-5" />} title="Exhaustion" tag="03">
        <div className="text-sm text-slate-700 leading-relaxed">
          <p className="mb-3">
            <span className="badge bg-brand-600 text-white mr-2 px-3 py-1 uppercase tracking-wider font-semibold">
              {(analysis.exhaustion_rule || 'undetermined')}
            </span>
            {analysis.exhaustion_rule === 'vertical' && (
              <span className="text-slate-500 text-xs">Excess attaches once the directly-underlying primary is exhausted.</span>
            )}
            {analysis.exhaustion_rule === 'horizontal' && (
              <span className="text-slate-500 text-xs">All primary policies must exhaust before any excess attaches.</span>
            )}
          </p>
          {analysis.raw_engine_output?.exhaustion_analysis?.rationale && (
            <p>{analysis.raw_engine_output.exhaustion_analysis.rationale}</p>
          )}
          {analysis.exhaustion_rule_citation && (
            <p className="text-xs text-brand-700 mt-2 italic font-medium">{analysis.exhaustion_rule_citation}</p>
          )}
        </div>
      </Section>

      {analysis.narrative && (
        <Section icon={<Sparkles className="h-5 w-5" />} title="Opinion Summary" tag="04">
          <div className="prose prose-slate prose-sm max-w-none whitespace-pre-wrap leading-relaxed text-slate-700 first-letter:text-3xl first-letter:font-serif-brand first-letter:font-semibold first-letter:text-brand-700 first-letter:mr-1 first-letter:float-left first-letter:leading-none">
            {analysis.narrative}
          </div>
        </Section>
      )}

      <footer className="mt-12 pt-6 border-t border-brand-100/80 text-center text-xs text-slate-400">
        <span className="font-serif-brand text-brand-700 tracking-wider">LexClause</span> · Coverage priority engine · Citations drawn only from the curated catalog
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Multi-state comparison
// ──────────────────────────────────────────────────────────────────────────
export function ComparisonResult({ comparison, headerActions }) {
  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <img src="/logo-icon.png" alt="LexClause" className="h-12 w-12 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">LexClause</span>
              <span className="text-xs text-slate-500 tracking-wide">Multi-state coverage priority comparison</span>
            </div>
          </div>
          {headerActions}
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Jurisdictional Comparison</span>
        </h1>
        <p className="text-slate-600 mt-6 text-base">
          Same matter, <strong className="text-brand-700">{comparison.length}</strong> jurisdictions side-by-side.
        </p>
      </header>

      <div className="grid lg:grid-cols-3 gap-4">
        {comparison.map(a => {
          const triggered = (a.lc_analysis_results || []).filter(r => r.triggered === 'yes' || r.triggered === 'partial')
          const notTrig   = (a.lc_analysis_results || []).filter(r => r.triggered === 'no')
          return (
            <div key={a.id} className="rounded-2xl overflow-hidden border border-brand-200/60 shadow-card bg-white flex flex-col">
              <div
                className="px-5 py-4 text-white"
                style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-500) 100%)' }}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-brand-100/90 font-semibold mb-0.5">
                  Governing law
                </div>
                <div className="flex items-baseline justify-between">
                  <h2 className="font-serif-brand text-3xl tracking-tight leading-none">{a.governing_state}</h2>
                  <span className="text-[11px] uppercase tracking-wider text-brand-50 font-semibold">
                    {(a.exhaustion_rule || '—')}
                  </span>
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col">
                <div className="text-[11px] uppercase tracking-wider text-brand-700 font-semibold mb-2">Triggered</div>
                <ul className="text-sm text-slate-700 space-y-1.5 mb-4">
                  {triggered.map(r => (
                    <li key={r.id} className="flex items-start gap-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 mt-0.5 flex-shrink-0" />
                      <span className="flex-1">
                        <span className="font-medium text-slate-900">{r.carrier}</span>
                        {r.priority_rank && (
                          <span className="ml-2 inline-block text-[10px] uppercase tracking-wider font-semibold text-brand-700 bg-brand-50 border border-brand-200 rounded-full px-2 py-0.5">
                            {r.priority_rank}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                  {notTrig.map(r => (
                    <li key={r.id} className="flex items-start gap-2 text-slate-400">
                      <X className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                      <span className="line-through">{r.carrier}</span>
                    </li>
                  ))}
                </ul>

                {a.priority_rule_citation && (
                  <p className="text-[11px] text-brand-700 italic font-medium mt-auto pt-3 border-t border-brand-100 leading-snug">
                    {a.priority_rule_citation}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <footer className="mt-12 pt-6 border-t border-brand-100/80 text-center text-xs text-slate-400">
        <span className="font-serif-brand text-brand-700 tracking-wider">LexClause</span> · Coverage priority engine · Citations drawn only from the curated catalog
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────
export function ExportMenu({ payload }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [emailOpen, setEmailOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const exportAs = async (format) => {
    if (busy) return
    setBusy(true); setOpen(false)
    try {
      if (format === 'docx') await downloadMemoDocx(payload)
      else                   await downloadMemoPdf(payload)
      toast.success(`Opinion exported as ${format.toUpperCase()}`)
    } catch (e) {
      console.error('Export failed', e)
      toast.error(e?.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="relative" ref={ref}>
        <button onClick={() => setOpen(o => !o)} disabled={busy} className="btn-primary">
          <Download className="h-4 w-4" />
          {busy ? 'Generating…' : 'Export opinion'}
          <ChevronDown className="h-3.5 w-3.5 -mr-1 opacity-80" />
        </button>
        {open && (
          <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-modal z-30 overflow-hidden">
            <button
              onClick={() => exportAs('docx')}
              className="flex w-full items-start gap-3 px-3 py-2.5 hover:bg-brand-50 text-left"
            >
              <FileText className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Download Word (.docx)</div>
                <div className="text-xs text-slate-500">Editable for further drafting</div>
              </div>
            </button>
            <button
              onClick={() => exportAs('pdf')}
              className="flex w-full items-start gap-3 px-3 py-2.5 hover:bg-brand-50 text-left border-t border-slate-100"
            >
              <FileType className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Download PDF</div>
                <div className="text-xs text-slate-500">Finalized for filing or distribution</div>
              </div>
            </button>
            <button
              onClick={() => { setOpen(false); setEmailOpen(true) }}
              className="flex w-full items-start gap-3 px-3 py-2.5 hover:bg-brand-50 text-left border-t border-slate-100"
            >
              <Mail className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
              <div>
                <div className="text-sm font-medium text-slate-900">Email opinion…</div>
                <div className="text-xs text-slate-500">Send .docx + .pdf to one or more recipients</div>
              </div>
            </button>
          </div>
        )}
      </div>

      {emailOpen && (
        <EmailModal
          payload={payload}
          onClose={() => setEmailOpen(false)}
        />
      )}
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// EmailModal — chip-style multi-recipient input + subject + message + send
// ──────────────────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function EmailModal({ payload, onClose }) {
  const matterName = payload?.matter?.name || payload?.analysis?.lc_matters?.name || 'Matter'
  const govState   = payload?.analysis?.governing_state || payload?.matter?.governing_state || ''
  const defaultSubject = `Coverage Priority Opinion · ${matterName}`

  const [chips, setChips]       = useState([])
  const [draft, setDraft]       = useState('')
  const [subject, setSubject]   = useState(defaultSubject)
  const [message, setMessage]   = useState('')
  const [includeDocx, setDocx]  = useState(true)
  const [includePdf, setPdf]    = useState(true)
  const [sending, setSending]   = useState(false)

  const inputRef = useRef(null)

  const commitDraft = () => {
    const t = draft.trim().replace(/[,;]+$/, '')
    if (!t) return
    if (!EMAIL_RE.test(t)) {
      toast.error(`Not a valid email: ${t}`)
      return
    }
    if (chips.includes(t.toLowerCase())) { setDraft(''); return }
    setChips([...chips, t.toLowerCase()])
    setDraft('')
  }

  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ',' || e.key === ';') {
      e.preventDefault()
      commitDraft()
    } else if (e.key === 'Backspace' && !draft && chips.length) {
      setChips(chips.slice(0, -1))
    }
  }

  const onPaste = (e) => {
    const text = e.clipboardData.getData('text')
    if (text.includes(',') || text.includes(';') || text.includes('\n') || text.includes(' ')) {
      e.preventDefault()
      const tokens = text.split(/[,;\s]+/).map(t => t.trim().toLowerCase()).filter(t => EMAIL_RE.test(t))
      const next = Array.from(new Set([...chips, ...tokens]))
      setChips(next)
      setDraft('')
    }
  }

  const removeChip = (e) => setChips(chips.filter(c => c !== e))

  const canSend = chips.length > 0 && (includeDocx || includePdf) && !sending

  async function handleSend() {
    if (!canSend) return
    // Allow trailing typed-but-uncommitted email
    let recipients = chips
    const tail = draft.trim()
    if (tail && EMAIL_RE.test(tail)) {
      recipients = Array.from(new Set([...chips, tail.toLowerCase()]))
    }
    setSending(true)
    try {
      const attachments = []
      if (includeDocx) {
        const blob = await buildMemoDocx(payload)
        const b64 = await blobToBase64(blob)
        attachments.push({
          filename: `LexClause_Opinion_${safeName(matterName)}.docx`,
          content_base64: b64,
          content_type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
      }
      if (includePdf) {
        const doc = await buildMemoPdf(payload)
        const blob = doc.output('blob')
        const b64 = await blobToBase64(blob)
        attachments.push({
          filename: `LexClause_Opinion_${safeName(matterName)}.pdf`,
          content_base64: b64,
          content_type: 'application/pdf',
        })
      }
      const result = await emailOpinion({
        recipients,
        subject,
        message,
        matter_name: matterName,
        governing_state: govState || undefined,
        attachments,
      })
      toast.success(`Opinion emailed to ${(result?.sent_to || recipients).length} recipient${(result?.sent_to || recipients).length === 1 ? '' : 's'}`)
      onClose()
    } catch (e) {
      console.error('Email send failed', e)
      toast.error(e?.message || 'Email send failed')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-2xl shadow-2xl shadow-brand-900/40 overflow-hidden bg-white"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="h-1.5"
          style={{ background: 'linear-gradient(90deg, var(--brand-700), var(--brand-500), var(--brand-300))' }}
          aria-hidden="true"
        />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700 mb-1">
                LexClause
              </div>
              <h2 className="font-serif-brand text-2xl uppercase tracking-tight text-slate-900 leading-none">
                Email opinion
              </h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 -mr-1 -mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Recipients (chip input) */}
            <div>
              <label className="form-label">Recipients</label>
              <div
                className="form-input flex flex-wrap items-center gap-1.5 cursor-text min-h-[42px]"
                onClick={() => inputRef.current?.focus()}
              >
                {chips.map(c => (
                  <span
                    key={c}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-brand-100 text-brand-800 text-xs font-medium border border-brand-200"
                  >
                    {c}
                    <button
                      onClick={() => removeChip(c)}
                      className="hover:text-brand-900 -mr-0.5"
                      aria-label={`Remove ${c}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  ref={inputRef}
                  type="email"
                  className="flex-1 min-w-[8rem] outline-none bg-transparent text-sm py-0.5"
                  placeholder={chips.length === 0 ? 'a@firm.com, b@firm.com' : ''}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={onKey}
                  onBlur={commitDraft}
                  onPaste={onPaste}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Press Enter, comma, or semicolon to add. Up to 25 recipients per send.
              </p>
            </div>

            {/* Subject */}
            <div>
              <label className="form-label">Subject</label>
              <input
                type="text"
                className="form-input"
                value={subject}
                onChange={e => setSubject(e.target.value)}
              />
            </div>

            {/* Optional cover note */}
            <div>
              <label className="form-label">Message <span className="text-slate-400 font-normal">(optional)</span></label>
              <textarea
                rows={3}
                className="form-input resize-none"
                placeholder="Optional cover note. Appears above the attached opinion in the email body."
                value={message}
                onChange={e => setMessage(e.target.value)}
              />
            </div>

            {/* Attachment toggles */}
            <div>
              <div className="form-label">Attach</div>
              <div className="flex items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeDocx}
                    onChange={e => setDocx(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700">Word (.docx)</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePdf}
                    onChange={e => setPdf(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />
                  <span className="text-slate-700">PDF</span>
                </label>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-6 pt-5 border-t border-slate-100">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="btn-primary"
              style={{ fontVariant: 'all-small-caps' }}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {sending ? 'Sending…' : `Send to ${chips.length || 0}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload  = () => {
      const dataUrl = String(r.result || '')
      const idx = dataUrl.indexOf(',')
      resolve(idx >= 0 ? dataUrl.slice(idx + 1) : dataUrl)
    }
    r.onerror = () => reject(new Error('FileReader failed'))
    r.readAsDataURL(blob)
  })
}

function safeName(s) {
  return String(s || 'matter').replace(/[^a-z0-9_\-]+/gi, '_').slice(0, 80)
}

function Section({ icon, title, tag, children }) {
  return (
    <section className="card p-6 mb-5 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-brand-600 to-brand-400" aria-hidden="true" />
      <div className="flex items-baseline justify-between mb-4 pl-2">
        <h2 className="font-serif-brand text-2xl text-slate-900 flex items-center gap-2.5 tracking-tight">
          <span className="text-brand-600 inline-flex">{icon}</span>
          <span className="uppercase">{title}</span>
        </h2>
        {tag && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-300 select-none">
            §{tag}
          </span>
        )}
      </div>
      <div className="pl-2">{children}</div>
    </section>
  )
}

function TriggerCard({ r }) {
  const triggered = r.triggered
  const palette =
    triggered === 'yes'     ? 'bg-emerald-50/60 border-emerald-200' :
    triggered === 'partial' ? 'bg-amber-50/60   border-amber-200'   :
                              'bg-slate-50/60   border-slate-200'
  const accentBar =
    triggered === 'yes'     ? 'bg-emerald-500' :
    triggered === 'partial' ? 'bg-amber-500'   :
                              'bg-slate-300'
  const badge =
    triggered === 'yes'     ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
    triggered === 'partial' ? 'bg-amber-100   text-amber-800   border border-amber-200'   :
                              'bg-slate-200   text-slate-600   border border-slate-300'
  return (
    <div className={`relative pl-4 pr-4 py-3.5 rounded-lg border ${palette} overflow-hidden`}>
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentBar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-medium text-slate-900">
          {r.carrier} <span className="text-slate-400 font-normal">· {r.policy_number}</span>
        </div>
        <span className={`badge ${badge} uppercase tracking-wider font-semibold`}>{triggered || '—'}</span>
      </div>
      {r.coverage_grant_basis && (
        <p className="text-xs text-slate-600 italic mb-1">{r.coverage_grant_basis}</p>
      )}
      {r.trigger_rationale && (
        <p className="text-sm text-slate-700 leading-relaxed">{r.trigger_rationale}</p>
      )}
    </div>
  )
}

function PriorityCard({ r }) {
  const ranks = {
    'primary':     { badge: 'bg-brand-600 text-white border border-brand-700',           bar: 'bg-brand-600' },
    'co-primary':  { badge: 'bg-brand-100 text-brand-800 border border-brand-300',       bar: 'bg-brand-400' },
    'excess':      { badge: 'bg-purple-100 text-purple-800 border border-purple-200',   bar: 'bg-purple-500' },
    'sub-excess':  { badge: 'bg-violet-100 text-violet-800 border border-violet-200',   bar: 'bg-violet-500' },
  }
  const style = ranks[r.priority_rank] || { badge: 'bg-slate-100 text-slate-700 border border-slate-200', bar: 'bg-slate-300' }
  return (
    <div className="relative pl-4 pr-4 py-3.5 rounded-lg border border-slate-200 bg-white overflow-hidden">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${style.bar}`} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3 mb-1">
        <div className="font-medium text-slate-900">
          {r.carrier} <span className="text-slate-400 font-normal">· {r.policy_number}</span>
        </div>
        <span className={`badge ${style.badge} uppercase tracking-wider font-semibold`}>{r.priority_rank || '—'}</span>
      </div>
      {r.priority_rank_basis && <p className="text-sm text-slate-700 leading-relaxed mb-1">{r.priority_rank_basis}</p>}
      {r.other_insurance_quote && (
        <p className="text-xs text-slate-500 italic mt-2 border-l-2 border-brand-300/70 pl-2.5 bg-brand-50/40 py-1.5 rounded-r">
          "{r.other_insurance_quote}"
        </p>
      )}
    </div>
  )
}
