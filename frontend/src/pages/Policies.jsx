import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, Plus, Search } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

export default function Policies() {
  const { profile } = useAuth()
  const [search, setSearch] = useState('')

  const { data: policies = [], isLoading } = useQuery({
    queryKey: ['pa_policies', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pa_policies')
        .select('id, carrier, policy_number, named_insured, effective_date, expiration_date, state_issued, policy_form, per_occurrence_limit, extraction_status')
        .eq('org_id', profile.org_id)
        .order('effective_date', { ascending: false })
      if (error) throw error
      return data
    }
  })

  const filtered = policies.filter(p => {
    if (!search) return true
    const s = search.toLowerCase()
    return [p.carrier, p.policy_number, p.named_insured].some(v => (v || '').toLowerCase().includes(s))
  })

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Policies</h1>
          <p className="text-slate-600 mt-1">All policies your firm has indexed.</p>
        </div>
        <Link to="/policies/upload" className="btn-primary">
          <Plus className="h-4 w-4" /> Upload Policy
        </Link>
      </header>

      <div className="card p-4 mb-6">
        <div className="relative">
          <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="search"
            placeholder="Search by carrier, policy number, or insured…"
            className="form-input pl-10"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading policies…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 mb-4">{search ? 'No policies match that search.' : 'No policies yet.'}</p>
            {!search && (
              <Link to="/policies/upload" className="btn-primary inline-flex">
                <Plus className="h-4 w-4" /> Upload your first policy
              </Link>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Carrier</th>
                <th className="px-4 py-3 font-semibold">Policy #</th>
                <th className="px-4 py-3 font-semibold">Insured</th>
                <th className="px-4 py-3 font-semibold">Period</th>
                <th className="px-4 py-3 font-semibold">State</th>
                <th className="px-4 py-3 font-semibold">Limit</th>
                <th className="px-4 py-3 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/policies/${p.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                      {p.carrier || 'Untitled carrier'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600 font-mono text-xs">{p.policy_number || '—'}</td>
                  <td className="px-4 py-3 text-slate-700">{p.named_insured || '—'}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {p.effective_date && p.expiration_date
                      ? `${p.effective_date} → ${p.expiration_date}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600">{p.state_issued || '—'}</td>
                  <td className="px-4 py-3 text-slate-700 font-mono text-xs">
                    {p.per_occurrence_limit
                      ? `$${Number(p.per_occurrence_limit).toLocaleString()}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <ExtractionBadge status={p.extraction_status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function ExtractionBadge({ status }) {
  const map = {
    pending:    { label: 'Pending',  className: 'bg-slate-100 text-slate-700' },
    extracting: { label: 'Analyzing', className: 'bg-amber-100 text-amber-800' },
    complete:   { label: 'Indexed',  className: 'bg-emerald-100 text-emerald-800' },
    failed:     { label: 'Failed',   className: 'bg-red-100 text-red-800' },
  }
  const m = map[status] || map.pending
  return <span className={`badge ${m.className}`}>{m.label}</span>
}
