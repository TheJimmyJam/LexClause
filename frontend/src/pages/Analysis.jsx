import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download, AlertTriangle, CheckCircle2, FileText, FileType, ChevronDown, Loader2, XCircle } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { downloadMemoDocx, downloadMemoPdf } from '../lib/generateCoverageMemo.js'
import toast from 'react-hot-toast'

export default function Analysis() {
  const { matterId, analysisId } = useParams()
  const { profile } = useAuth()

  const { data: analysis } = useQuery({
    queryKey: ['lc_analysis', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('*, lc_analysis_results(*), lc_matters(*)')
        .eq('id', analysisId)
        .single()
      if (error) throw error
      return data
    },
    // Poll while the engine is still working in the background.
    // Once status flips to 'complete' or 'failed', stop polling.
    refetchInterval: (q) => {
      const s = q?.state?.data?.status
      return s === 'running' || s === 'pending' ? 2000 : false
    },
    refetchIntervalInBackground: true,
  })

  if (!analysis) return <div className="p-10 text-center text-slate-500">Loading analysis…</div>

  const results = (analysis.lc_analysis_results || []).slice().sort((a, b) => {
    const layerOrder = { primary: 0, umbrella: 1, excess: 2, self_insured: 3 }
    const la = layerOrder[a.layer] ?? 99, lb = layerOrder[b.layer] ?? 99
    if (la !== lb) return la - lb
    return (a.attachment_point || 0) - (b.attachment_point || 0)
  })
  const total = results.reduce((acc, r) => acc + Number(r.allocated_amount || 0), 0)
  const insuredRetention = Number(analysis.insured_retention || 0)
  const grandTotal = total + insuredRetention

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <Link to={`/matters/${matterId}`} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matter
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Coverage Allocation</h1>
          <p className="text-slate-600 mt-1">{analysis.lc_matters?.name}</p>
        </div>
        {analysis.status === 'complete' && (
          <ExportMenu
            analysis={analysis}
            matter={analysis.lc_matters}
            results={results}
            organization={profile?.organization}
          />
        )}
      </div>

      {(analysis.status === 'running' || analysis.status === 'pending') && (
        <RunningCard attempts={analysis.validation_attempts} />
      )}

      {analysis.status === 'failed' && (
        <FailedCard error={analysis.error} />
      )}

      {analysis.status === 'complete' && (
        <ValidationBanner
          status={analysis.validation_status}
          errors={analysis.validation_errors}
          attempts={analysis.validation_attempts}
        />
      )}

      {analysis.status === 'complete' && (<>

      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <Stat label="Governing law"     value={analysis.governing_state} />
        <Stat label="Allocation method" value={(analysis.allocation_method || '').replaceAll('_', ' ')} />
        <Stat label="Trigger"           value={(analysis.trigger_theory || '').replaceAll('_', ' ')} />
      </div>

      {analysis.tower_explanation && (
        <div className="card p-5 mb-6 border-brand-200/60 bg-brand-50/30">
          <div className="text-xs uppercase tracking-wide text-brand-700 font-semibold mb-2">Tower structure</div>
          <p className="text-sm text-slate-700 leading-relaxed">{analysis.tower_explanation}</p>
        </div>
      )}

      <div className="card overflow-hidden mb-8">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900">Per-Carrier Allocation</h2>
        </div>
        {results.length === 0 ? (
          <div className="p-10 text-center text-slate-500 text-sm">No allocation rows yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Layer</th>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Policy #</th>
                <th className="px-4 py-3 font-semibold text-right">Attach</th>
                <th className="px-4 py-3 font-semibold text-right">Limit</th>
                <th className="px-4 py-3 font-semibold text-right">Share</th>
                <th className="px-4 py-3 font-semibold text-right">Allocated $</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 align-top">
                  <td className="px-4 py-3"><LayerBadge layer={r.layer} /></td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {r.carrier}
                    {r.rationale && (
                      <div className="text-xs text-slate-500 mt-1 font-normal leading-relaxed">{r.rationale}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">{r.policy_number}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">{fmtMoneyOrDash(r.attachment_point)}</td>
                  <td className="px-4 py-3 text-right text-slate-600 font-mono text-xs">{fmtMoneyOrDash(r.applicable_limit)}</td>
                  <td className="px-4 py-3 text-right text-slate-700">{(Number(r.share_pct) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-mono">${Number(r.allocated_amount || 0).toLocaleString()}</td>
                </tr>
              ))}
              {insuredRetention > 0 && (
                <tr className="hover:bg-slate-50">
                  <td className="px-4 py-3"><LayerBadge layer="self_insured" /></td>
                  <td className="px-4 py-3 font-medium text-slate-900">Insured retention</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">—</td>
                  <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">—</td>
                  <td className="px-4 py-3 text-right text-slate-400 font-mono text-xs">—</td>
                  <td className="px-4 py-3 text-right text-slate-700">{((insuredRetention / grandTotal) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-mono">${insuredRetention.toLocaleString()}</td>
                </tr>
              )}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={6} className="px-4 py-3 text-right">Total</td>
                <td className="px-4 py-3 text-right font-mono">${grandTotal.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-3">Methodology</h2>
        <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
          {analysis.methodology_text || <span className="text-slate-400 italic">Methodology not yet generated.</span>}
        </pre>
      </div>
      </>)}
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">{label}</div>
      <div className="text-slate-900 font-medium">{value || '—'}</div>
    </div>
  )
}

function LayerBadge({ layer }) {
  const map = {
    primary:      { label: 'Primary',  cls: 'bg-emerald-100 text-emerald-800' },
    umbrella:     { label: 'Umbrella', cls: 'bg-amber-100 text-amber-800' },
    excess:       { label: 'Excess',   cls: 'bg-purple-100 text-purple-800' },
    self_insured: { label: 'SIR',      cls: 'bg-slate-200 text-slate-700' },
  }
  const m = map[layer] || { label: '—', cls: 'bg-slate-100 text-slate-500' }
  return <span className={`badge ${m.cls}`}>{m.label}</span>
}

function fmtMoneyOrDash(n) {
  if (n == null || n === '') return '—'
  return `$${Number(n).toLocaleString()}`
}

function RunningCard({ attempts }) {
  return (
    <div className="card p-8 mb-8 border-brand-200/60 bg-gradient-to-br from-brand-50/50 to-cyan-50/30">
      <div className="flex items-start gap-4">
        <Loader2 className="h-6 w-6 text-brand-600 animate-spin flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h2 className="font-semibold text-slate-900 mb-1">Running coverage allocation…</h2>
          <p className="text-sm text-slate-600">
            Claude is reading the policies, applying the controlling state's rule, and validating the math.
            This usually takes 20-60 seconds; if validation fails, the engine retries up to three times.
          </p>
          {attempts > 0 && (
            <p className="text-xs text-brand-700 mt-3 font-medium">
              {attempts === 1 ? 'First attempt completed.' : `On attempt ${attempts}/3.`} Re-running with the validator's corrections.
            </p>
          )}
          <div className="mt-5 space-y-1.5">
            <ProgressStep label="Build the policy tower"        done />
            <ProgressStep label="Apply the controlling rule"    done />
            <ProgressStep label="Generate per-carrier shares"   pending />
            <ProgressStep label="Validate math against limits"  pending />
            <ProgressStep label="Draft methodology memo"        pending />
          </div>
        </div>
      </div>
    </div>
  )
}

function ProgressStep({ label, done, pending }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : (
        <Loader2 className="h-3.5 w-3.5 text-brand-500 animate-spin" />
      )}
      <span className={done ? 'text-slate-600' : 'text-slate-700 font-medium'}>{label}</span>
    </div>
  )
}

function FailedCard({ error }) {
  return (
    <div className="card p-6 mb-8 border-red-200/80 bg-red-50/40">
      <div className="flex items-start gap-3">
        <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-red-900 mb-1">Analysis failed</h2>
          <p className="text-sm text-red-800">
            The engine couldn't produce a valid allocation. You can re-run from the matter page.
          </p>
          {error && (
            <pre className="text-xs text-red-700 mt-3 whitespace-pre-wrap font-mono bg-red-100/50 p-2 rounded">
              {error}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

function ExportMenu({ analysis, matter, results, organization }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    function onDocClick(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const exportAs = async (format) => {
    if (busy) return
    setBusy(true); setOpen(false)
    try {
      const payload = { analysis, matter, results, organization }
      if (format === 'docx')      await downloadMemoDocx(payload)
      else if (format === 'pdf')        downloadMemoPdf(payload)
      toast.success(`Memo exported as ${format.toUpperCase()}`)
    } catch (e) {
      console.error(e)
      toast.error(e.message || 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        disabled={busy}
        className="btn-primary"
      >
        <Download className="h-4 w-4" />
        {busy ? 'Generating…' : 'Export memo'}
        <ChevronDown className="h-3.5 w-3.5 -mr-1 opacity-80" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white border border-slate-200 rounded-lg shadow-modal z-20 overflow-hidden">
          <button
            onClick={() => exportAs('docx')}
            className="flex w-full items-start gap-3 px-3 py-2.5 hover:bg-slate-50 text-left"
          >
            <FileText className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-slate-900">Word (.docx)</div>
              <div className="text-xs text-slate-500">Editable for further drafting</div>
            </div>
          </button>
          <button
            onClick={() => exportAs('pdf')}
            className="flex w-full items-start gap-3 px-3 py-2.5 hover:bg-slate-50 text-left border-t border-slate-100"
          >
            <FileType className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
            <div>
              <div className="text-sm font-medium text-slate-900">PDF</div>
              <div className="text-xs text-slate-500">Finalized for filing or distribution</div>
            </div>
          </button>
        </div>
      )}
    </div>
  )
}

function ValidationBanner({ status, errors, attempts }) {
  if (!status || status === 'not_run') return null
  const errs = Array.isArray(errors) ? errors : []
  if (status === 'valid') {
    return (
      <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm">
        <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-emerald-600" />
        <div>
          <span className="font-medium">Reconciled.</span>{' '}
          Per-carrier amounts sum to the damages exposure and no allocation exceeds policy limits.
          {attempts > 1 && <span className="text-emerald-700/80"> Reached after {attempts} attempts (auto-corrected).</span>}
        </div>
      </div>
    )
  }
  return (
    <div className="flex items-start gap-3 p-3 mb-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm">
      <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-600" />
      <div className="flex-1">
        <span className="font-semibold">Needs review.</span>{' '}
        Allocation didn't reconcile after {attempts || 1} attempt{(attempts || 1) === 1 ? '' : 's'}. Treat the numbers as a draft and verify before relying on them.
        {errs.length > 0 && (
          <ul className="mt-2 space-y-1 list-disc list-inside text-amber-800">
            {errs.map((e, i) => <li key={i}>{e.message}</li>)}
          </ul>
        )}
      </div>
    </div>
  )
}
