import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Plus, AlertTriangle, CheckCircle2, Loader2, Search, Upload } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'

const fmtMoney = (n) => {
  const v = Number(n || 0)
  if (v === 0) return '—'
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(0)}k`
  return `$${v.toLocaleString()}`
}
const cap = (s) => (s ? String(s).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—')

export default function Matters() {
  const { profile } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [search, setSearch] = useState('')

  const { data: matters = [], isLoading, refetch } = useQuery({
    queryKey: ['lc_matters', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_matters')
        .select('id, name, venue_state, governing_state, loss_type, damages_exposure, created_at, lc_matter_policies(policy_id), lc_analyses(id, status, validation_status, allocation_method, created_at)')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const filtered = matters.filter(m => {
    if (!search) return true
    const s = search.toLowerCase()
    return (m.name || '').toLowerCase().includes(s)
        || (m.governing_state || '').toLowerCase().includes(s)
        || (m.loss_type || '').toLowerCase().includes(s)
  })

  const handleCreate = async (e) => {
    e.preventDefault()
    if (!name.trim() || !profile?.org_id) return
    const { data, error } = await supabase
      .from('lc_matters')
      .insert({ org_id: profile.org_id, name: name.trim() })
      .select()
      .single()
    if (error) { toast.error(error.message); return }
    toast.success('Matter created.')
    setName('')
    setCreating(false)
    refetch()
  }

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Matters</h1>
          <p className="text-slate-600 mt-1">Coverage priority analyses by matter.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/matters/intake" className="btn-secondary">
            <Upload className="h-4 w-4" /> From a document
          </Link>
          <button onClick={() => setCreating(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> New Matter
          </button>
        </div>
      </header>

      {creating && (
        <form onSubmit={handleCreate} className="card p-5 mb-6 flex gap-3">
          <input
            autoFocus
            placeholder="Matter name (e.g. Acme Corp v. NorthStar Builders)"
            className="form-input flex-1"
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <button type="submit" className="btn-primary">Create</button>
          <button type="button" onClick={() => { setCreating(false); setName('') }} className="btn-secondary">Cancel</button>
        </form>
      )}

      {matters.length > 0 && (
        <div className="card p-4 mb-6">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="search"
              placeholder="Search by name, state, or loss type…"
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
        ) : matters.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No matters yet. Create one to start a coverage analysis.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">No matters match that search.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Matter</th>
                <th className="px-4 py-3 font-semibold">Loss type</th>
                <th className="px-4 py-3 font-semibold">Governing</th>
                <th className="px-4 py-3 font-semibold text-right">Exposure</th>
                <th className="px-4 py-3 font-semibold text-center">Policies</th>
                <th className="px-4 py-3 font-semibold">Latest analysis</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(m => {
                const policyCount = (m.lc_matter_policies || []).length
                const latest = (m.lc_analyses || [])
                  .slice()
                  .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]
                return (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <Link to={`/matters/${m.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                        {m.name}
                      </Link>
                      <div className="text-xs text-slate-500 mt-0.5">{new Date(m.created_at).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 text-xs">{cap(m.loss_type)}</td>
                    <td className="px-4 py-3 text-slate-600">{m.governing_state || '—'}</td>
                    <td className="px-4 py-3 text-right text-slate-700 font-mono text-xs">{fmtMoney(m.damages_exposure)}</td>
                    <td className="px-4 py-3 text-center text-slate-600">{policyCount}</td>
                    <td className="px-4 py-3"><AnalysisStatusBadge analysis={latest} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function AnalysisStatusBadge({ analysis }) {
  if (!analysis) return <span className="badge bg-slate-100 text-slate-500">No analysis</span>
  if (analysis.status === 'running' || analysis.status === 'pending') {
    return (
      <span className="badge bg-brand-100 text-brand-800 inline-flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin" /> Running
      </span>
    )
  }
  if (analysis.status === 'failed') return <span className="badge bg-red-100 text-red-800">Failed</span>
  if (analysis.validation_status === 'valid') {
    return (
      <span className="badge bg-emerald-100 text-emerald-800 inline-flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" /> Reconciled
      </span>
    )
  }
  if (analysis.validation_status === 'needs_review') {
    return (
      <span className="badge bg-amber-100 text-amber-800 inline-flex items-center gap-1">
        <AlertTriangle className="h-3 w-3" /> Review
      </span>
    )
  }
  return <span className="badge bg-slate-100 text-slate-700">Complete</span>
}
