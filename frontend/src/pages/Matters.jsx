import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FolderOpen, Plus } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import toast from 'react-hot-toast'

export default function Matters() {
  const { profile } = useAuth()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')

  const { data: matters = [], isLoading, refetch } = useQuery({
    queryKey: ['lc_matters', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_matters')
        .select('id, name, venue_state, governing_state, loss_type, created_at')
        .eq('org_id', profile.org_id)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    }
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
          <p className="text-slate-600 mt-1">Coverage matters where allocation analyses live.</p>
        </div>
        <button onClick={() => setCreating(true)} className="btn-primary">
          <Plus className="h-4 w-4" /> New Matter
        </button>
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

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading…</div>
        ) : matters.length === 0 ? (
          <div className="p-12 text-center">
            <FolderOpen className="h-10 w-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600">No matters yet. Create one to start a coverage analysis.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Matter</th>
                <th className="px-4 py-3 font-semibold">Loss type</th>
                <th className="px-4 py-3 font-semibold">Venue</th>
                <th className="px-4 py-3 font-semibold">Governing law</th>
                <th className="px-4 py-3 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matters.map(m => (
                <tr key={m.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link to={`/matters/${m.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                      {m.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{m.loss_type || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.venue_state || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{m.governing_state || '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{new Date(m.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
