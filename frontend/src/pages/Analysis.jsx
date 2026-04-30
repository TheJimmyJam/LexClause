import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function Analysis() {
  const { matterId, analysisId } = useParams()

  const { data: analysis } = useQuery({
    queryKey: ['lc_analysis', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('*, lc_analysis_results(*), lc_matters(name, governing_state, venue_state, loss_type)')
        .eq('id', analysisId)
        .single()
      if (error) throw error
      return data
    }
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
        <button className="btn-secondary"><Download className="h-4 w-4" /> Export memo</button>
      </div>

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
