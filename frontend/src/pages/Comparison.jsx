/**
 * Comparison — view a past multi-state coverage_priority comparison.
 *
 * Fetches all lc_analyses sharing the comparison_group_id and renders the
 * shared ComparisonResult viewer. Polls while any analysis in the group is
 * still running.
 */

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { ComparisonResult } from '../components/AnalysisView.jsx'

export default function Comparison() {
  const { comparisonGroupId } = useParams()

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
    return (
      <div className="p-10 text-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
        Loading comparison…
      </div>
    )
  }

  const allComplete = analyses.every(a => a.status === 'complete' || a.status === 'failed')

  if (!allComplete) {
    return (
      <div className="p-6 lg:p-10 max-w-3xl mx-auto">
        <Link to="/matters" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
          <ArrowLeft className="h-3.5 w-3.5" /> Past matters
        </Link>
        <div className="rounded-2xl overflow-hidden border border-brand-200/60 shadow-card">
          <div
            className="px-6 py-8 text-white"
            style={{ background: 'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 45%, var(--brand-500) 100%)' }}
          >
            <div className="flex items-center gap-5">
              <div className="relative h-16 w-16 flex-shrink-0">
                <div
                  className="absolute inset-0 rounded-2xl border-2 border-white/40 border-t-white"
                  style={{ animation: 'spin 1.4s linear infinite' }}
                />
                <div className="absolute inset-1 rounded-xl bg-white/95 flex items-center justify-center shadow-md">
                  <img src="/logo-icon.png" alt="" className="h-9 w-9" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] uppercase tracking-[0.22em] text-brand-100/90 font-semibold mb-1">
                  LexClause is working
                </div>
                <h2 className="font-serif-brand text-3xl uppercase tracking-tight leading-none">
                  <span className="lc-title-underline">Comparing</span>
                </h2>
                <p
                  className="text-brand-50/95 text-sm mt-3 tracking-wide"
                  style={{ fontVariant: 'all-small-caps' }}
                >
                  Running {analyses.length} jurisdictions in parallel. This page refreshes automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const backToHistory = (
    <Link to="/matters" className="btn-secondary">
      <ArrowLeft className="h-4 w-4" /> Past matters
    </Link>
  )

  return <ComparisonResult comparison={analyses} headerActions={backToHistory} />
}
