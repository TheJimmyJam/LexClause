/**
 * AdminConsole — operator-only "god mode" view across every organization in
 * LexClause. Restricted to users in lc_super_admins (currently auto-promoted
 * for wcannon83@gmail.com and masonwm1@gmail.com).
 *
 * RLS already lets super admins read every lc_* table. This page just queries
 * without an org filter and lays out the cross-org picture.
 */

import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, Link } from 'react-router-dom'
import {
  Shield, Users, FileText, Scale, ChevronDown, Search, ArrowLeft, Copy,
  XCircle, Trash2, RefreshCw,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const APP_URL = (typeof window !== 'undefined' && window.location.origin) || 'https://lexclause.netlify.app'

export default function AdminConsole() {
  const { isSuperAdmin, loading: authLoading } = useAuth()
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState(null)  // org_id of expanded row

  // Pull every org with member + matter + analysis counts.
  const { data: orgs = [], isLoading } = useQuery({
    queryKey: ['lc_admin_orgs'],
    enabled:  !!isSuperAdmin,
    queryFn:  fetchOrgsWithStats,
  })

  if (authLoading) return <div className="p-10 text-center text-slate-500">Loading…</div>
  if (!isSuperAdmin) return <Navigate to="/analyze" replace />

  const filtered = orgs.filter(o => {
    if (!search) return true
    const s = search.toLowerCase()
    return (o.name || '').toLowerCase().includes(s)
        || (o.id || '').toLowerCase().includes(s)
  })

  const totals = useMemo(() => ({
    orgs:     orgs.length,
    members:  orgs.reduce((s, o) => s + (o.member_count   || 0), 0),
    matters:  orgs.reduce((s, o) => s + (o.matter_count   || 0), 0),
    analyses: orgs.reduce((s, o) => s + (o.analysis_count || 0), 0),
  }), [orgs])

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <img src="/logo-icon.png" alt="LexClause" className="h-12 w-12 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">LexClause</span>
              <span className="text-xs text-slate-500 tracking-wide">Operator console</span>
            </div>
          </div>
          <Link to="/analyze" className="btn-secondary"><ArrowLeft className="h-4 w-4" /> Back to app</Link>
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Admin</span>
        </h1>
        <p className="text-slate-600 mt-6 text-base tracking-wide" style={{ fontVariant: 'all-small-caps' }}>
          God-mode visibility across every organization in LexClause.
        </p>
      </header>

      {/* Banner — make it clear they're in the operator view */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-4 mb-6 flex items-start gap-3">
        <Shield className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-900 leading-relaxed">
          <strong>You are viewing data across all customer organizations.</strong> Treat this view with the
          same confidentiality you'd treat any privileged client information. RLS allows it because
          you're listed in <code className="bg-amber-100 px-1 rounded font-mono">lc_super_admins</code>;
          for normal use of your own firm's data, navigate via the regular sidebar.
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <KPI label="Organizations" value={totals.orgs}     icon={Users} />
        <KPI label="Members"        value={totals.members}  icon={Users} />
        <KPI label="Matters"        value={totals.matters}  icon={FileText} />
        <KPI label="Analyses"       value={totals.analyses} icon={Scale} />
      </div>

      {/* Stuck analyses panel */}
      <StuckAnalyses />

      {/* Search */}
      {orgs.length > 0 && (
        <div className="card p-3 mb-4">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="search"
              placeholder="Search by org name or ID…"
              className="form-input pl-10 text-sm"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Org list */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm italic">
            {orgs.length === 0 ? 'No organizations yet.' : 'No orgs match that search.'}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {filtered.map(o => (
              <OrgRow
                key={o.id}
                org={o}
                expanded={expanded === o.id}
                onToggle={() => setExpanded(expanded === o.id ? null : o.id)}
              />
            ))}
          </ul>
        )}
      </div>

      <footer className="mt-12 pt-6 text-center text-xs text-slate-400">
        <span className="font-serif-brand text-brand-700 tracking-wider">LexClause</span>
        <span className="mx-2 text-slate-300">·</span>
        <span style={{ fontVariant: 'all-small-caps' }}>Operator console</span>
      </footer>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Data
// ──────────────────────────────────────────────────────────────────────────
async function fetchOrgsWithStats() {
  // Pull all orgs (super admin RLS allows it). Then pull per-org counts in
  // parallel-ish queries. Counts are computed via head:true to avoid pulling
  // rows we don't need.
  const { data: orgs, error } = await supabase
    .from('lc_organizations')
    .select('id, name, created_at')
    .order('created_at', { ascending: false })
  if (error) throw error
  if (!orgs || orgs.length === 0) return []

  const ids = orgs.map(o => o.id)

  const fetchCounts = async (table) => {
    const out = {}
    // Run one query per org to get a count. Could be optimized with an RPC but
    // the org count is usually <100 so this is fine.
    await Promise.all(ids.map(async (id) => {
      const { count } = await supabase
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('org_id', id)
      out[id] = count ?? 0
    }))
    return out
  }

  const [members, matters, analyses] = await Promise.all([
    fetchCounts('lc_profiles'),
    fetchCounts('lc_matters'),
    fetchCounts('lc_analyses'),
  ])

  return orgs.map(o => ({
    ...o,
    member_count:   members[o.id]  ?? 0,
    matter_count:   matters[o.id]  ?? 0,
    analysis_count: analyses[o.id] ?? 0,
  }))
}

// ──────────────────────────────────────────────────────────────────────────
// Components
// ──────────────────────────────────────────────────────────────────────────

// Stuck Analyses — shows every analysis still in "running" status so the
// operator can kill (mark failed) or hard-delete them.
function StuckAnalyses() {
  const qc = useQueryClient()
  const { data: stuck = [], isLoading, refetch } = useQuery({
    queryKey: ['lc_admin_stuck_analyses'],
    refetchInterval: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_analyses')
        .select('id, status, mode, governing_state, created_at, matter_id, org_id, lc_matters(name)')
        .eq('status', 'running')
        .order('created_at', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  async function killAnalysis(id) {
    const { error } = await supabase
      .from('lc_analyses')
      .update({ status: 'failed', error: 'Killed by admin via operator console.' })
      .eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Analysis marked failed.')
    qc.invalidateQueries({ queryKey: ['lc_admin_stuck_analyses'] })
  }

  async function deleteAnalysis(id) {
    if (!window.confirm('Hard-delete this analysis and all its results? This cannot be undone.')) return
    // Delete results first (FK constraint), then the analysis row
    await supabase.from('lc_analysis_results').delete().eq('analysis_id', id)
    const { error } = await supabase.from('lc_analyses').delete().eq('id', id)
    if (error) { toast.error(error.message); return }
    toast.success('Analysis deleted.')
    qc.invalidateQueries({ queryKey: ['lc_admin_stuck_analyses'] })
    qc.invalidateQueries({ queryKey: ['lc_admin_orgs'] })
  }

  async function killAll() {
    if (!stuck.length) return
    if (!window.confirm(`Kill all ${stuck.length} stuck analyses?`)) return
    const ids = stuck.map(a => a.id)
    const { error } = await supabase
      .from('lc_analyses')
      .update({ status: 'failed', error: 'Killed by admin — bulk kill via operator console.' })
      .in('id', ids)
    if (error) { toast.error(error.message); return }
    toast.success(`Killed ${ids.length} analyses.`)
    qc.invalidateQueries({ queryKey: ['lc_admin_stuck_analyses'] })
  }

  if (isLoading) return null
  if (stuck.length === 0) return (
    <div className="card p-4 mb-6 flex items-center gap-3 text-sm text-slate-500">
      <XCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
      No stuck analyses — all clear.
      <button onClick={() => refetch()} className="ml-auto text-xs text-brand-700 hover:text-brand-800 font-medium inline-flex items-center gap-1">
        <RefreshCw className="h-3 w-3" /> Refresh
      </button>
    </div>
  )

  return (
    <div className="card overflow-hidden mb-6 border-amber-200">
      <div className="px-5 py-3 bg-amber-50/60 border-b border-amber-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <XCircle className="h-4 w-4 text-amber-600 flex-shrink-0" />
          <span className="text-sm font-semibold text-amber-900">
            {stuck.length} stuck {stuck.length === 1 ? 'analysis' : 'analyses'} — status: running
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="text-xs text-amber-700 hover:text-amber-900 inline-flex items-center gap-1">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <button
            onClick={killAll}
            className="btn-sm bg-amber-600 hover:bg-amber-700 text-white text-xs px-3 py-1 rounded-lg font-medium"
          >
            Kill all
          </button>
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {stuck.map(a => {
          const ageMs   = Date.now() - new Date(a.created_at).getTime()
          const ageMins = Math.round(ageMs / 60_000)
          const matterName = a.lc_matters?.name || '(unnamed matter)'
          return (
            <li key={a.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{matterName}</div>
                <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-[10px]">{a.id}</span>
                  <span className="text-slate-300">·</span>
                  <span>{a.mode === 'coverage_priority' ? 'Coverage priority' : 'Allocation'}</span>
                  <span className="text-slate-300">·</span>
                  <span>{a.governing_state || '—'}</span>
                  <span className="text-slate-300">·</span>
                  <span className={ageMins > 10 ? 'text-red-600 font-semibold' : 'text-amber-700'}>
                    {ageMins}m old
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => killAnalysis(a.id)}
                  className="text-xs font-medium text-amber-700 hover:text-amber-900 inline-flex items-center gap-1 px-2 py-1 rounded border border-amber-200 hover:bg-amber-50"
                >
                  <XCircle className="h-3 w-3" /> Kill
                </button>
                <button
                  onClick={() => deleteAnalysis(a.id)}
                  className="text-xs font-medium text-red-600 hover:text-red-800 inline-flex items-center gap-1 px-2 py-1 rounded border border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-3 w-3" /> Delete
                </button>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function KPI({ label, value, icon: Icon }) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-slate-500 font-semibold mb-1">
        <Icon className="h-3.5 w-3.5 text-brand-600" />
        {label}
      </div>
      <div className="text-2xl font-serif-brand text-slate-900 tracking-tight">{value.toLocaleString()}</div>
    </div>
  )
}

function OrgRow({ org, expanded, onToggle }) {
  return (
    <li>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-brand-50/30 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="font-medium text-slate-900 truncate">{org.name || '(unnamed org)'}</div>
          <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-3 flex-wrap">
            <span>created {new Date(org.created_at).toLocaleDateString()}</span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[10px]">{org.id}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <Stat n={org.member_count}   label="members"  />
          <Stat n={org.matter_count}   label="matters"  />
          <Stat n={org.analysis_count} label="analyses" />
          <ChevronDown
            className={`h-4 w-4 text-slate-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          />
        </div>
      </button>
      {expanded && <OrgDetails org={org} />}
    </li>
  )
}

function Stat({ n, label }) {
  return (
    <span className="inline-flex items-center gap-1 text-slate-600">
      <strong className="text-slate-900">{n}</strong>
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{label}</span>
    </span>
  )
}

function OrgDetails({ org }) {
  const qc = useQueryClient()
  const { data: members = [] } = useQuery({
    queryKey: ['lc_admin_org_members', org.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lc_profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .eq('org_id', org.id)
        .order('created_at', { ascending: true })
      return data ?? []
    },
  })

  const { data: matters = [] } = useQuery({
    queryKey: ['lc_admin_org_matters', org.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lc_matters')
        .select('id, name, governing_state, created_at')
        .eq('org_id', org.id)
        .order('created_at', { ascending: false })
        .limit(10)
      return data ?? []
    },
  })

  const { data: pendingInvites = [], refetch: refetchInvites } = useQuery({
    queryKey: ['lc_admin_org_invites', org.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('lc_invitations')
        .select('id, email, role, token, created_at, expires_at, accepted_at, revoked_at')
        .eq('org_id', org.id)
        .is('accepted_at', null)
        .is('revoked_at',  null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      return data ?? []
    },
  })

  return (
    <div className="bg-slate-50/60 border-t border-slate-100 px-5 py-4">
      <div className="grid lg:grid-cols-2 gap-5 mb-5">
        <div>
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-brand-700 font-semibold mb-2">Members</h4>
          {members.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No members.</p>
          ) : (
            <ul className="space-y-1.5">
              {members.map(m => (
                <li key={m.id} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                  <span className="truncate">
                    {(m.first_name || m.last_name) ? `${m.first_name || ''} ${m.last_name || ''}`.trim() : m.email}
                    <span className="text-slate-400 ml-2">{m.email}</span>
                  </span>
                  <RoleBadge role={m.role} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-brand-700 font-semibold mb-2">Recent matters (max 10)</h4>
          {matters.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No matters.</p>
          ) : (
            <ul className="space-y-1.5">
              {matters.map(m => (
                <li key={m.id} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                  <span className="truncate">{m.name || '(unnamed)'}</span>
                  <span className="text-slate-400 flex-shrink-0">
                    {m.governing_state || '—'} · {new Date(m.created_at).toLocaleDateString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Pending invitations for this org */}
      {pendingInvites.length > 0 && (
        <div className="mt-4 pt-4 border-t border-slate-200">
          <h4 className="text-[10px] uppercase tracking-[0.18em] text-amber-700 font-semibold mb-2">
            Pending invitations · {pendingInvites.length}
          </h4>
          <ul className="space-y-1.5">
            {pendingInvites.map(i => (
              <li key={i.id} className="text-xs text-slate-700 flex items-center justify-between gap-2">
                <span className="truncate">
                  {i.email}
                  <span className="text-slate-400 ml-2">· {i.role}</span>
                </span>
                <button
                  onClick={() => {
                    const link = `${APP_URL}/register?invite=${i.token}&email=${encodeURIComponent(i.email)}`
                    navigator.clipboard.writeText(link)
                      .then(() => toast.success('Invite link copied'))
                      .catch(() => toast.error('Could not copy'))
                  }}
                  className="text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium"
                >
                  <Copy className="h-3 w-3" /> copy link
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}


function RoleBadge({ role }) {
  if (role === 'admin') {
    return <span className="badge bg-brand-100 text-brand-800 border border-brand-200 text-[10px] uppercase tracking-wider font-semibold">Admin</span>
  }
  return <span className="badge bg-slate-200 text-slate-700 border border-slate-300 text-[10px] uppercase tracking-wider font-semibold">Member</span>
}
