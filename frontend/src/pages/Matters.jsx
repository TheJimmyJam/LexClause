/**
 * Matters — "Past matters" history view.
 *
 * Lists every coverage_priority analysis the user's organization has ever run.
 * Click into one → /matters/:matterId/analysis/:analysisId, which renders the
 * SingleStateResult or ComparisonResult viewer.
 *
 * No "create new matter" UI here — new matters are created exclusively through
 * the Analyzer drop-everything flow. This page is read-only history.
 */

import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { CheckCircle2, AlertTriangle, Loader2, Search, Sparkles, Plus, History } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const cap = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—')

export default function Matters() {
  const { profile } = useAuth()
  const [search, setSearch] = useState('')

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['lc_analyses', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('id, matter_id, mode, governing_state, exhaustion_rule, status, validation_status, created_at, comparison_group_id, lc_matters(name)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) throw error
      return data
    },
  })

  // Group comparison-group analyses (same comparisonGroupId = one user-facing entry)
  const grouped = (() => {
    const seen = new Set()
    const rows = []
    for (const a of analyses) {
      if (a.comparison_group_id) {
        if (seen.has(a.comparison_group_id)) continue
        seen.add(a.comparison_group_id)
        const peers = analyses.filter(x => x.comparison_group_id === a.comparison_group_id)
        rows.push({
          kind: 'comparison',
          id: a.comparison_group_id,
          matter_id: a.matter_id,
          matter_name: a.lc_matters?.name,
          created_at: a.created_at,
          peers,
        })
      } else {
        rows.push({
          kind: 'single',
          ...a,
          matter_name: a.lc_matters?.name,
        })
      }
    }
    return rows
  })()

  const filtered = grouped.filter(r => {
    if (!search) return true
    const s = search.toLowerCase()
    return (r.matter_name || '').toLowerCase().includes(s)
        || (r.governing_state || '').toLowerCase().includes(s)
  })

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
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
              <span className="text-xs text-slate-500 tracking-wide">Past matters</span>
            </div>
          </div>
          <Link to="/analyze" className="btn-primary">
            <Sparkles className="h-4 w-4" /> New analysis
          </Link>
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">History</span>
        </h1>
        <p
          className="text-slate-600 mt-6 text-base tracking-wide"
          style={{ fontVariant: 'all-small-caps' }}
        >
          Every coverage priority opinion you've run.
        </p>
      </header>

      {grouped.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Search by matter name or governing state…"
              className="form-input pl-10"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : grouped.length === 0 ? (
          <EmptyState />
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No matters match that search.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(r => (
              <PastMatterRow key={`${r.kind}-${r.id}`} row={r} />
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-12 pt-6 text-center text-xs text-slate-400">
        <span className="font-serif-brand text-brand-700 tracking-wider">LexClause</span>
        <span className="mx-2 text-slate-300">·</span>
        <span style={{ fontVariant: 'all-small-caps' }}>Citations drawn only from the curated catalog</span>
      </footer>
    </div>
  )
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <History className="h-10 w-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-700 font-medium mb-1">No analyses yet.</p>
      <p className="text-slate-500 text-sm mb-5">
        Drop policies and a complaint to run your first coverage priority opinion.
      </p>
      <Link to="/analyze" className="btn-primary inline-flex">
        <Sparkles className="h-4 w-4" /> New analysis
      </Link>
    </div>
  )
}

function PastMatterRow({ row }) {
  if (row.kind === 'comparison') {
    return (
      <li className="px-5 py-4 hover:bg-brand-50/30">
        <Link to={`/matters/${row.matter_id}/compare/${row.id}`} className="flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="font-medium text-slate-900 truncate">
              {row.matter_name || 'Untitled matter'}
            </div>
            <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span>{new Date(row.created_at).toLocaleDateString()}</span>
              <span className="text-slate-300">·</span>
              <span>Multi-state: {row.peers.map(p => p.governing_state).filter(Boolean).join(' / ')}</span>
            </div>
          </div>
          <ComparisonStatusBadge peers={row.peers} />
        </Link>
      </li>
    )
  }

  const a = row
  return (
    <li className="px-5 py-4 hover:bg-brand-50/30">
      <Link to={`/matters/${a.matter_id}/analysis/${a.id}`} className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-slate-900 truncate">
            {a.matter_name || 'Untitled matter'}
          </div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{new Date(a.created_at).toLocaleDateString()}</span>
            <span className="text-slate-300">·</span>
            <span className="font-medium text-brand-700">{a.governing_state || '—'}</span>
            <span className="text-slate-300">·</span>
            <span>{a.mode === 'coverage_priority' ? 'Coverage priority' : (a.mode === 'allocation' ? 'Allocation (legacy)' : 'Analysis')}</span>
            {a.exhaustion_rule && (
              <>
                <span className="text-slate-300">·</span>
                <span className="uppercase tracking-wider">{a.exhaustion_rule}</span>
              </>
            )}
          </div>
        </div>
        <SingleStatusBadge a={a} />
      </Link>
    </li>
  )
}

function SingleStatusBadge({ a }) {
  if (a.status === 'running' || a.status === 'pending') {
    return (
      <span className="badge bg-brand-100 text-brand-800 inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    )
  }
  if (a.status === 'failed') return <span className="badge bg-red-100 text-red-800">Failed</span>
  if (a.validation_status === 'valid') {
    return (
      <span className="badge bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Validated
      </span>
    )
  }
  if (a.validation_status === 'needs_review') {
    return (
      <span className="badge bg-amber-100 text-amber-800 inline-flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Review
      </span>
    )
  }
  return <span className="badge bg-slate-100 text-slate-700">Complete</span>
}

function ComparisonStatusBadge({ peers }) {
  const allDone = peers.every(p => p.status === 'complete' || p.status === 'failed')
  if (!allDone) {
    return (
      <span className="badge bg-brand-100 text-brand-800 inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    )
  }
  return (
    <span className="badge bg-brand-50 text-brand-800 border border-brand-200">
      {peers.length} states
    </span>
  )
}
