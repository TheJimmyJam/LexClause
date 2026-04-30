import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { FileText, FolderOpen, Upload, Sparkles, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

function StatCard({ icon: Icon, label, value, href, accent }) {
  const card = (
    <div className="card p-5 hover:shadow-card-hover transition-shadow cursor-pointer">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold">{label}</div>
          <div className="text-3xl font-bold text-slate-900 mt-1">{value}</div>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  )
  return href ? <Link to={href}>{card}</Link> : card
}

export default function Dashboard() {
  const { profile } = useAuth()

  const { data: counts } = useQuery({
    queryKey: ['lexclause-dashboard-counts', profile?.org_id],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const [{ count: policyCount }, { count: matterCount }, { count: analysisCount }] = await Promise.all([
        supabase.from('lc_policies').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
        supabase.from('lc_matters').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
        supabase.from('lc_analyses').select('*', { count: 'exact', head: true }).eq('org_id', profile.org_id),
      ])
      return {
        policies: policyCount  ?? 0,
        matters:  matterCount  ?? 0,
        analyses: analysisCount ?? 0,
      }
    }
  })

  return (
    <div className="p-6 lg:p-10 max-w-7xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Welcome back{profile?.first_name ? `, ${profile.first_name}` : ''}</h1>
        <p className="text-slate-600 mt-1">Coverage allocation across multi-policy, multi-state matters.</p>
      </header>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        <StatCard icon={FileText}   label="Policies in library" value={counts?.policies ?? '—'} href="/policies" accent="bg-brand-50 text-brand-700" />
        <StatCard icon={FolderOpen} label="Matters"             value={counts?.matters ?? '—'}  href="/matters"  accent="bg-cyan-50 text-cyan-700" />
        <StatCard icon={Sparkles}   label="Analyses run"        value={counts?.analyses ?? '—'} accent="bg-emerald-50 text-emerald-700" />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Link to="/policies/upload" className="card p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
              <Upload className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900">Upload a policy</h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm text-slate-600">Drop a PDF — Claude extracts limits, retentions, and other-insurance language into structured fields.</p>
            </div>
          </div>
        </Link>

        <Link to="/matters" className="card p-6 hover:shadow-card-hover transition-shadow group">
          <div className="flex items-start gap-4">
            <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <h3 className="font-semibold text-slate-900">Run an allocation</h3>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand-600 group-hover:translate-x-0.5 transition-all" />
              </div>
              <p className="text-sm text-slate-600">Open a matter, select policies and the governing state, and run the allocation.</p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
