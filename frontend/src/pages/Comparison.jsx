import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Loader2, XCircle,
  GitCompareArrows, MapPin,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'

const fmtMoney = (n) => {
  const v = Number(n || 0)
  if (v === 0) return '$0'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toLocaleString()}`
}
const fmtMoneyExact = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const cap = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—')

export default function Comparison() {
  const { matterId, comparisonGroupId } = useParams()

  const { data: analyses = [] } = useQuery({
    queryKey: ['lc_comparison', comparisonGroupId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('*, lc_analysis_results(*), lc_matters(name, damages_exposure)')
        .eq('comparison_group_id', comparisonGroupId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    refetchInterval: (q) => {
      const rows = q?.state?.data || []
      const anyRunning = rows.some(r => r.status === 'running' || r.status === 'pending')
      return anyRunning ? 2000 : false
    },
    refetchIntervalInBackground: true,
  })

  if (analyses.length === 0) {
    return <div className="p-10 text-center text-slate-500">Loading comparison…</div>
  }

  const matter = analyses[0]?.lc_matters
  const exposure = Number(matter?.damages_exposure || 0)
  const allComplete = analyses.every(a => a.status === 'complete')

  // Build a unified carrier table — rows = unique carriers across all analyses,
  // columns = analyses (one per state).
  const carrierRows = (() => {
    const carriers = new Map() // key = carrier|policy_number, value = { carrier, policy_number, layer, byAnalysis: { [aid]: amount } }
    for (const a of analyses) {
      for (const r of a.lc_analysis_results || []) {
        const key = `${(r.carrier || '').trim()}|${(r.policy_number || '').trim()}`
        if (!carriers.has(key)) {
          carriers.set(key, {
            key,
            carrier: r.carrier,
            policy_number: r.policy_number,
            layer: r.layer,
            byAnalysis: {},
          })
        }
        carriers.get(key).byAnalysis[a.id] = Number(r.allocated_amount || 0)
      }
    }
    // Sort by total dollars allocated across all analyses (highest first)
    return Array.from(carriers.values()).sort((a, b) => {
      const ta = Object.values(a.byAnalysis).reduce((s, v) => s + v, 0)
      const tb = Object.values(b.byAnalysis).reduce((s, v) => s + v, 0)
      return tb - ta
    })
  })()

  // Carrier-by-carrier divergence (max - min across states), helpful summary
  const divergences = carrierRows
    .map(c => {
      const vals = analyses.map(a => c.byAnalysis[a.id] ?? 0)
      const max = Math.max(...vals)
      const min = Math.min(...vals)
      return { ...c, spread: max - min }
    })
    .filter(c => c.spread > 0)
    .sort((a, b) => b.spread - a.spread)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <Link to={`/matters/${matterId}`} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matter
      </Link>

      <div className="flex items-start gap-3 mb-2">
        <div className="w-10 h-10 rounded-lg bg-brand-100 text-brand-700 flex items-center justify-center flex-shrink-0">
          <GitCompareArrows className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Jurisdiction comparison</h1>
          <p className="text-slate-600 mt-1">{matter?.name}</p>
        </div>
      </div>

      {/* ── Header strip — one card per analysis ─────────────────────────── */}
      <div className={`grid gap-3 mt-6 mb-6 ${analyses.length === 2 ? 'sm:grid-cols-2' : analyses.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2 lg:grid-cols-4'}`}>
        {analyses.map(a => (
          <ScenarioHeader key={a.id} analysis={a} matterId={matterId} exposure={exposure} />
        ))}
      </div>

      {/* ── Per-carrier comparison table ─────────────────────────────────── */}
      {!allComplete ? (
        <div className="card p-8 text-center">
          <Loader2 className="h-6 w-6 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="text-slate-700 font-medium">Running scenarios in parallel…</p>
          <p className="text-xs text-slate-500 mt-1">
            {analyses.filter(a => a.status === 'complete').length} of {analyses.length} complete.
          </p>
        </div>
      ) : (
        <>
          <div className="card overflow-hidden mb-8">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Per-Carrier Analysis, by Jurisdiction</h2>
              <p className="text-xs text-slate-500 mt-0.5">Same matter, same policies — what changes is the controlling law.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold sticky left-0 bg-slate-50">Carrier</th>
                    <th className="px-4 py-3 font-semibold">Policy #</th>
                    <th className="px-4 py-3 font-semibold">Layer</th>
                    {analyses.map(a => (
                      <th key={a.id} className="px-4 py-3 font-semibold text-right whitespace-nowrap">
                        {a.governing_state} <span className="text-[10px] text-slate-400 font-normal block">{cap(a.allocation_method).slice(0, 18)}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {carrierRows.map(row => {
                    const vals = analyses.map(a => row.byAnalysis[a.id] ?? 0)
                    const max = Math.max(...vals)
                    return (
                      <tr key={row.key} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-white">{row.carrier}</td>
                        <td className="px-4 py-3 text-slate-600 font-mono text-xs whitespace-nowrap">{row.policy_number}</td>
                        <td className="px-4 py-3"><LayerBadge layer={row.layer} /></td>
                        {analyses.map(a => {
                          const v = row.byAnalysis[a.id] ?? 0
                          const isMax = max > 0 && v === max && vals.filter(x => x === max).length < vals.length
                          return (
                            <td key={a.id} className={`px-4 py-3 text-right font-mono text-xs ${v === 0 ? 'text-slate-300' : isMax ? 'text-brand-700 font-semibold' : 'text-slate-700'}`}>
                              {fmtMoneyExact(v)}
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                  {/* Insured retention row */}
                  <tr className="bg-amber-50/40">
                    <td className="px-4 py-3 font-medium text-slate-900 sticky left-0 bg-amber-50/40">Insured retention</td>
                    <td className="px-4 py-3 text-slate-400">—</td>
                    <td className="px-4 py-3"><LayerBadge layer="self_insured" /></td>
                    {analyses.map(a => (
                      <td key={a.id} className="px-4 py-3 text-right font-mono text-xs text-slate-700">
                        {fmtMoneyExact(a.insured_retention || 0)}
                      </td>
                    ))}
                  </tr>
                  {/* Total row */}
                  <tr className="bg-slate-50 font-semibold">
                    <td className="px-4 py-3 sticky left-0 bg-slate-50" colSpan={3}>Total</td>
                    {analyses.map(a => {
                      const total = (a.lc_analysis_results || []).reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
                            + Number(a.insured_retention || 0)
                      return (
                        <td key={a.id} className="px-4 py-3 text-right font-mono">{fmtMoneyExact(total)}</td>
                      )
                    })}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Key differences ─────────────────────────────────────────── */}
          {divergences.length > 0 && (
            <div className="card p-6 mb-8">
              <h2 className="font-semibold text-slate-900 mb-1">Where the jurisdictions diverge most</h2>
              <p className="text-xs text-slate-500 mb-4">Carriers whose share varies most across the {analyses.length} candidate states.</p>
              <div className="space-y-3">
                {divergences.slice(0, 5).map(d => {
                  const vals = analyses.map(a => ({
                    state: a.governing_state,
                    amount: d.byAnalysis[a.id] ?? 0,
                  }))
                  const maxVal = Math.max(...vals.map(v => v.amount))
                  return (
                    <div key={d.key} className="bg-slate-50 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-slate-900 text-sm">{d.carrier}</div>
                        <div className="text-xs text-slate-500">
                          Spread: <span className="font-mono text-slate-700">{fmtMoneyExact(d.spread)}</span>
                        </div>
                      </div>
                      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2">
                        {vals.map(v => (
                          <div key={v.state} className={`px-3 py-2 rounded ${v.amount === maxVal && maxVal > 0 ? 'bg-brand-100 border border-brand-200' : 'bg-white border border-slate-200'}`}>
                            <div className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold flex items-center gap-1">
                              <MapPin className="h-2.5 w-2.5" /> {v.state}
                            </div>
                            <div className={`font-mono text-sm mt-0.5 ${v.amount === 0 ? 'text-slate-400' : 'text-slate-900'}`}>{fmtMoneyExact(v.amount)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Methodology accordion (one per state) ─────────────────── */}
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">Methodology by jurisdiction</h2>
            </div>
            <ul className="divide-y divide-slate-100">
              {analyses.map(a => (
                <li key={a.id} className="p-5">
                  <div className="flex items-start justify-between mb-2 gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="badge bg-brand-100 text-brand-800">{a.governing_state}</span>
                        <span className="badge bg-slate-100 text-slate-700">{cap(a.allocation_method)}</span>
                        <span className="badge bg-slate-100 text-slate-700">{cap(a.trigger_theory)}</span>
                      </div>
                      {a.tower_explanation && (
                        <p className="text-sm text-slate-600 mt-2 leading-relaxed">{a.tower_explanation}</p>
                      )}
                    </div>
                    <Link to={`/matters/${matterId}/analysis/${a.id}`} className="text-xs text-brand-700 hover:text-brand-800 font-medium whitespace-nowrap">
                      Open full memo →
                    </Link>
                  </div>
                  {a.methodology_text && (
                    <details className="mt-2 text-sm text-slate-700">
                      <summary className="cursor-pointer text-xs text-brand-700 hover:text-brand-800 font-medium">Show full methodology</summary>
                      <pre className="whitespace-pre-wrap leading-relaxed mt-3 text-slate-700">{a.methodology_text}</pre>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────
function ScenarioHeader({ analysis, matterId, exposure }) {
  const total = (analysis.lc_analysis_results || []).reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
  const ir    = Number(analysis.insured_retention || 0)
  const insuredPct = exposure > 0 ? (ir / exposure) * 100 : 0

  let statusBadge = null
  if (analysis.status === 'running' || analysis.status === 'pending') {
    statusBadge = <span className="badge bg-brand-100 text-brand-800 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Running</span>
  } else if (analysis.status === 'failed') {
    statusBadge = <span className="badge bg-red-100 text-red-800 inline-flex items-center gap-1"><XCircle className="h-3 w-3" /> Failed</span>
  } else if (analysis.validation_status === 'valid') {
    statusBadge = <span className="badge bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Reconciled</span>
  } else if (analysis.validation_status === 'needs_review') {
    statusBadge = <span className="badge bg-amber-100 text-amber-800 inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Review</span>
  } else {
    statusBadge = <span className="badge bg-slate-100 text-slate-700">Complete</span>
  }

  return (
    <Link to={`/matters/${matterId}/analysis/${analysis.id}`} className="card p-4 hover:shadow-card-hover transition-shadow block">
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-slate-900 leading-none">{analysis.governing_state || '—'}</div>
          <div className="text-xs text-slate-500 mt-1">{cap(analysis.allocation_method) || 'pending'}</div>
        </div>
        {statusBadge}
      </div>
      {analysis.status === 'complete' && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-slate-500">To carriers</span>
            <span className="font-mono text-slate-700">{fmtMoney(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Insured retention</span>
            <span className="font-mono text-slate-700">{fmtMoney(ir)} {ir > 0 && <span className="text-slate-400">({insuredPct.toFixed(0)}%)</span>}</span>
          </div>
        </div>
      )}
    </Link>
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
