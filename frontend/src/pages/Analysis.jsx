import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Download } from 'lucide-react'
import { supabase } from '../lib/supabase.js'

export default function Analysis() {
  const { matterId, analysisId } = useParams()

  const { data: analysis } = useQuery({
    queryKey: ['pa_analysis', analysisId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pa_analyses')
        .select('*, pa_analysis_results(*), pa_matters(name, governing_state, venue_state, loss_type)')
        .eq('id', analysisId)
        .single()
      if (error) throw error
      return data
    }
  })

  if (!analysis) return <div className="p-10 text-center text-slate-500">Loading analysis…</div>

  const results = analysis.pa_analysis_results || []
  const total = results.reduce((acc, r) => acc + Number(r.allocated_amount || 0), 0)

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <Link to={`/matters/${matterId}`} className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matter
      </Link>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Coverage Allocation</h1>
          <p className="text-slate-600 mt-1">{analysis.pa_matters?.name}</p>
        </div>
        <button className="btn-secondary"><Download className="h-4 w-4" /> Export memo</button>
      </div>

      <div className="grid sm:grid-cols-3 gap-3 mb-8">
        <Stat label="Governing law"     value={analysis.governing_state} />
        <Stat label="Allocation method" value={(analysis.allocation_method || '').replaceAll('_', ' ')} />
        <Stat label="Trigger"           value={(analysis.trigger_theory || '').replaceAll('_', ' ')} />
      </div>

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
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Policy #</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold text-right">Share</th>
                <th className="px-4 py-3 font-semibold text-right">Allocated $</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {results.map(r => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.carrier}</td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{r.policy_number}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {r.policy_effective} → {r.policy_expiration}
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700">{(Number(r.share_pct) * 100).toFixed(2)}%</td>
                  <td className="px-4 py-3 text-right font-mono">${Number(r.allocated_amount || 0).toLocaleString()}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-semibold">
                <td colSpan={4} className="px-4 py-3 text-right">Total</td>
                <td className="px-4 py-3 text-right font-mono">${total.toLocaleString()}</td>
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
