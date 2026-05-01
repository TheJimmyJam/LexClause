/**
 * Analysis — view a past coverage_priority analysis by id.
 *
 * Fetches the analysis row + its lc_analysis_results + parent matter and
 * renders the shared SingleStateResult viewer. Polls while the engine is
 * still running in the background.
 */

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Loader2, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { SingleStateResult } from '../components/AnalysisView.jsx'

export default function Analysis() {
  const { matterId, analysisId } = useParams()

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
    refetchInterval: (q) => {
      const s = q?.state?.data?.status
      return s === 'running' || s === 'pending' ? 2000 : false
    },
    refetchIntervalInBackground: true,
  })

  if (!analysis) {
    return (
      <div className="p-10 text-center text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-3" />
        Loading analysis…
      </div>
    )
  }

  // Still running → show a small status block
  if (analysis.status === 'running' || analysis.status === 'pending') {
    return <BackgroundRunning matterId={matterId} analysis={analysis} />
  }

  if (analysis.status === 'failed') {
    return <FailedView matterId={matterId} analysis={analysis} />
  }

  // Complete — render the full opinion via the shared component
  const backToHistory = (
    <Link to="/matters" className="btn-secondary">
      <ArrowLeft className="h-4 w-4" /> Past matters
    </Link>
  )

  return <SingleStateResult analysis={analysis} headerActions={backToHistory} />
}

function BackgroundRunning({ matterId, analysis }) {
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
                <span className="lc-title-underline">Analyzing</span>
              </h2>
              <p
                className="text-brand-50/95 text-sm mt-3 tracking-wide"
                style={{ fontVariant: 'all-small-caps' }}
              >
                The engine is still generating this opinion. This page refreshes automatically.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FailedView({ matterId, analysis }) {
  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <Link to="/matters" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Past matters
      </Link>
      <div className="card p-6 border-red-200 bg-red-50/40 text-red-900">
        <div className="flex items-start gap-3">
          <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Analysis failed.</p>
            {analysis.error && (
              <pre className="text-xs mt-2 whitespace-pre-wrap bg-red-100/50 p-2 rounded font-mono">
                {analysis.error}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
