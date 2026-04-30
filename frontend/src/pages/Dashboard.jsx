import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  FileText, FolderOpen, Upload, Sparkles, ArrowRight,
  AlertTriangle, CheckCircle2, Loader2, DollarSign,
  TrendingUp, MapPin, Building2, Clock, Layers,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const fmtMoney = (n) => {
  const v = Number(n || 0)
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toLocaleString()}`
}
const fmtMoneyExact = (n) => `$${Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`
const cap = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—')

const ALLOCATION_COLORS = {
  pro_rata_time_on_risk:        'bg-blue-500',
  pro_rata_by_limits:           'bg-cyan-500',
  all_sums:                     'bg-emerald-500',
  all_sums_with_reallocation:   'bg-teal-500',
  equal_shares:                 'bg-amber-500',
  targeted_tender:              'bg-purple-500',
  undetermined:                 'bg-slate-400',
}

export default function Dashboard() {
  const { profile } = useAuth()

  // ── Aggregate metrics ──────────────────────────────────────────────────────
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const [matters, policies, analyses, results] = await Promise.all([
        supabase.from('lc_matters').select('id, name, governing_state, loss_type, damages_exposure, created_at').eq('org_id', profile.org_id),
        supabase.from('lc_policies').select('id, carrier, extraction_status').eq('org_id', profile.org_id),
        supabase.from('lc_analyses').select('id, matter_id, status, validation_status, allocation_method, total_amount, created_at').eq('org_id', profile.org_id),
        supabase.from('lc_analysis_results').select('carrier, allocated_amount, lc_analyses!inner(org_id, status)').eq('lc_analyses.org_id', profile.org_id).eq('lc_analyses.status', 'complete'),
      ])
      return {
        matters:  matters.data  ?? [],
        policies: policies.data ?? [],
        analyses: analyses.data ?? [],
        results:  results.data  ?? [],
      }
    }
  })

  // ── Recent matters (latest 5, with their most recent analysis) ─────────────
  const { data: recentMatters = [] } = useQuery({
    queryKey: ['dashboard-recent-matters', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_matters')
        .select('id, name, governing_state, loss_type, damages_exposure, created_at, lc_analyses(id, status, validation_status, allocation_method, created_at)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data
    }
  })

  // ── Recent analyses (latest 5) ─────────────────────────────────────────────
  const { data: recentAnalyses = [] } = useQuery({
    queryKey: ['dashboard-recent-analyses', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('id, matter_id, status, validation_status, validation_attempts, allocation_method, governing_state, total_amount, created_at, lc_matters(name)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
        .limit(5)
      if (error) throw error
      return data
    }
  })

  // ── Derived KPIs ───────────────────────────────────────────────────────────
  const exposureUnderMgmt = (stats?.matters || []).reduce((s, m) => s + Number(m.damages_exposure || 0), 0)
  const totalAllocated    = (stats?.results || []).reduce((s, r) => s + Number(r.allocated_amount || 0), 0)
  const needsReviewCount  = (stats?.analyses || []).filter(a => a.validation_status === 'needs_review').length
  const failedExtractionCount = (stats?.policies || []).filter(p => p.extraction_status === 'failed').length

  // ── Allocation method distribution ─────────────────────────────────────────
  const methodCounts = {}
  for (const a of stats?.analyses || []) {
    if (a.status !== 'complete') continue
    const m = a.allocation_method || 'undetermined'
    methodCounts[m] = (methodCounts[m] || 0) + 1
  }
  const totalCompleted = Object.values(methodCounts).reduce((s, n) => s + n, 0)
  const methodEntries = Object.entries(methodCounts).sort((a, b) => b[1] - a[1])

  // ── Top carriers by allocated $ ────────────────────────────────────────────
  const carrierTotals = {}
  for (const r of stats?.results || []) {
    const c = (r.carrier || 'Unknown').trim()
    carrierTotals[c] = (carrierTotals[c] || 0) + Number(r.allocated_amount || 0)
  }
  const topCarriers = Object.entries(carrierTotals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
  const topCarrierMax = topCarriers[0]?.[1] || 1

  // ── Governing-state distribution ───────────────────────────────────────────
  const stateCounts = {}
  for (const m of stats?.matters || []) {
    if (!m.governing_state) continue
    stateCounts[m.governing_state] = (stateCounts[m.governing_state] || 0) + 1
  }
  const topStates = Object.entries(stateCounts).sort((a, b) => b[1] - a[1]).slice(0, 6)

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">
          Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}
        </h1>
        <p className="text-slate-600 mt-1">{profile?.organization?.name || 'LexClause'} — coverage allocation overview.</p>
      </header>

      {/* ── KPI strip ──────────────────────────────────────────────────────── */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <KPICard
          icon={DollarSign}
          accent="bg-brand-50 text-brand-700"
          label="Exposure under management"
          value={fmtMoney(exposureUnderMgmt)}
          sub={`${stats?.matters?.length ?? 0} matter${stats?.matters?.length === 1 ? '' : 's'}`}
        />
        <KPICard
          icon={TrendingUp}
          accent="bg-emerald-50 text-emerald-700"
          label="Allocated to carriers"
          value={fmtMoney(totalAllocated)}
          sub={`${totalCompleted} complete analys${totalCompleted === 1 ? 'is' : 'es'}`}
        />
        <KPICard
          icon={AlertTriangle}
          accent={needsReviewCount > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-50 text-slate-500'}
          label="Needs review"
          value={needsReviewCount}
          sub={needsReviewCount === 0 ? 'All analyses reconcile' : 'Validation flagged a mismatch'}
        />
        <KPICard
          icon={FileText}
          accent={failedExtractionCount > 0 ? 'bg-red-50 text-red-700' : 'bg-slate-50 text-slate-500'}
          label="Failed extractions"
          value={failedExtractionCount}
          sub={failedExtractionCount === 0 ? 'All policies indexed' : 'Re-run from the policy page'}
          href={failedExtractionCount > 0 ? '/policies' : null}
        />
      </div>

      {/* ── Two-column layout ──────────────────────────────────────────────── */}
      <div className="grid lg:grid-cols-3 gap-6 mb-8">

        {/* Recent matters — wide column */}
        <div className="lg:col-span-2 card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent matters</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest 5 across the org</p>
            </div>
            <Link to="/matters" className="text-xs text-brand-700 hover:text-brand-800 font-medium flex items-center gap-1">
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          {recentMatters.length === 0 ? (
            <div className="p-10 text-center">
              <FolderOpen className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No matters yet. Create one to get started.</p>
              <Link to="/matters" className="btn-primary inline-flex mt-4 text-sm">Open Matters</Link>
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentMatters.map(m => {
                const latestAnalysis = (m.lc_analyses || []).sort((a, b) =>
                  new Date(b.created_at) - new Date(a.created_at)
                )[0]
                return (
                  <li key={m.id}>
                    <Link to={`/matters/${m.id}`} className="block px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-slate-900 truncate">{m.name}</div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                            {m.governing_state && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {m.governing_state}
                              </span>
                            )}
                            {m.loss_type && (
                              <span className="inline-flex items-center gap-1">
                                <Layers className="h-3 w-3" /> {cap(m.loss_type)}
                              </span>
                            )}
                            {m.damages_exposure && (
                              <span className="inline-flex items-center gap-1">
                                <DollarSign className="h-3 w-3" /> {fmtMoney(m.damages_exposure)} exposure
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex-shrink-0">
                          <AnalysisStatusBadge analysis={latestAnalysis} />
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Right column: distributions */}
        <div className="space-y-6">

          {/* Allocation methods */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-900 mb-1">Allocation methods</h2>
            <p className="text-xs text-slate-500 mb-4">Across {totalCompleted} complete analys{totalCompleted === 1 ? 'is' : 'es'}</p>
            {methodEntries.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No completed analyses yet.</p>
            ) : (
              <div className="space-y-2.5">
                {methodEntries.map(([method, n]) => {
                  const pct = totalCompleted > 0 ? (n / totalCompleted) * 100 : 0
                  return (
                    <div key={method}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-700 font-medium">{cap(method)}</span>
                        <span className="text-slate-500">{n} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${ALLOCATION_COLORS[method] || 'bg-slate-400'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Governing-state mix */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-900 mb-1">Governing law</h2>
            <p className="text-xs text-slate-500 mb-4">Top jurisdictions across matters</p>
            {topStates.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No matters have a governing state set.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {topStates.map(([code, n]) => (
                  <span key={code} className="badge bg-brand-50 text-brand-800 border border-brand-200">
                    {code} · {n}
                  </span>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Recent analyses + top carriers ─────────────────────────────────── */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">

        {/* Recent analyses */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="font-semibold text-slate-900">Recent analyses</h2>
              <p className="text-xs text-slate-500 mt-0.5">Latest 5 allocation runs</p>
            </div>
          </div>
          {recentAnalyses.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">No analyses yet.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAnalyses.map(a => (
                <li key={a.id}>
                  <Link to={`/matters/${a.matter_id}/analysis/${a.id}`} className="block px-5 py-3 hover:bg-slate-50">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-slate-900 truncate">
                          {a.lc_matters?.name || 'Untitled matter'}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <span>{a.governing_state || '—'}</span>
                          <span>·</span>
                          <span>{cap(a.allocation_method) || 'pending'}</span>
                          <span>·</span>
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {timeAgo(a.created_at)}
                          </span>
                        </div>
                      </div>
                      <AnalysisStatusBadge analysis={a} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Top carriers by allocated $ */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-900 mb-1">Top carriers by allocated $</h2>
          <p className="text-xs text-slate-500 mb-4">Across all complete analyses</p>
          {topCarriers.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No carrier allocations yet.</p>
          ) : (
            <div className="space-y-3">
              {topCarriers.map(([carrier, total]) => (
                <div key={carrier}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-800 font-medium truncate flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-slate-400" /> {carrier}
                    </span>
                    <span className="text-slate-700 font-mono">{fmtMoneyExact(total)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-brand-500" style={{ width: `${(total / topCarrierMax) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Quick actions ──────────────────────────────────────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">
        <QuickAction
          icon={Upload}
          accent="bg-brand-50 text-brand-700"
          to="/policies/upload"
          title="Upload a policy"
          desc="Drop a PDF — Claude extracts limits, retentions, and other-insurance language into structured fields."
        />
        <QuickAction
          icon={Sparkles}
          accent="bg-emerald-50 text-emerald-700"
          to="/matters"
          title="Run an allocation"
          desc="Open a matter, attach policies, choose the governing state, and run the allocation."
        />
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
function KPICard({ icon: Icon, label, value, sub, accent, href }) {
  const card = (
    <div className="card p-5 hover:shadow-card-hover transition-shadow h-full">
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="text-3xl font-bold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  )
  return href ? <Link to={href}>{card}</Link> : card
}

function QuickAction({ icon: Icon, accent, to, title, desc }) {
  return (
    <Link to={to} className="card p-6 hover:shadow-card-hover transition-shadow group">
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
          </div>
          <p className="text-sm text-slate-600">{desc}</p>
        </div>
      </div>
    </Link>
  )
}

function AnalysisStatusBadge({ analysis }) {
  if (!analysis) {
    return <span className="badge bg-slate-100 text-slate-600 whitespace-nowrap">No analysis</span>
  }
  if (analysis.status === 'running' || analysis.status === 'pending') {
    return (
      <span className="badge bg-brand-100 text-brand-800 whitespace-nowrap inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    )
  }
  if (analysis.status === 'failed') {
    return <span className="badge bg-red-100 text-red-800 whitespace-nowrap">Failed</span>
  }
  // complete
  if (analysis.validation_status === 'valid') {
    return (
      <span className="badge bg-emerald-100 text-emerald-800 whitespace-nowrap inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Reconciled
      </span>
    )
  }
  if (analysis.validation_status === 'needs_review') {
    return (
      <span className="badge bg-amber-100 text-amber-800 whitespace-nowrap inline-flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Needs review
      </span>
    )
  }
  return <span className="badge bg-slate-100 text-slate-700 whitespace-nowrap">Complete</span>
}

function timeAgo(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  const s = (Date.now() - d.getTime()) / 1000
  if (s < 60)        return 'just now'
  if (s < 3600)      return `${Math.round(s / 60)}m ago`
  if (s < 86400)     return `${Math.round(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.round(s / 86400)}d ago`
  return d.toLocaleDateString()
}
