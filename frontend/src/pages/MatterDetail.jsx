import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles, Plus } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { runAllocationAnalysis } from '../lib/policyAnalysis.js'
import { STATE_RULES, candidateJurisdictions } from '../lib/stateLaw.js'
import toast from 'react-hot-toast'

export default function MatterDetail() {
  const { matterId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: matter, refetch } = useQuery({
    queryKey: ['pa_matter', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pa_matters')
        .select('*, pa_matter_policies(policy_id, role, pa_policies(*)), pa_analyses(*)')
        .eq('id', matterId)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: orgPolicies = [] } = useQuery({
    queryKey: ['pa_policies', profile?.org_id, 'for-attach'],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pa_policies')
        .select('id, carrier, policy_number, effective_date, expiration_date')
        .eq('org_id', profile.org_id)
      if (error) throw error
      return data
    }
  })

  const [running, setRunning] = useState(false)

  if (!matter) return <div className="p-10 text-center text-slate-500">Loading…</div>

  const attachedPolicyIds = new Set((matter.pa_matter_policies || []).map(mp => mp.policy_id))
  const candidates = candidateJurisdictions({
    policyIssuedStates: (matter.pa_matter_policies || []).map(mp => mp.pa_policies?.state_issued).filter(Boolean),
    matterVenueState:   matter.venue_state,
    insuredHQState:     matter.insured_hq_state,
    lossLocationStates: matter.loss_location_states || [],
  })

  const updateMatter = async (patch) => {
    const { error } = await supabase.from('pa_matters').update(patch).eq('id', matterId)
    if (error) { toast.error(error.message); return }
    refetch()
  }

  const attachPolicy = async (policyId) => {
    const { error } = await supabase.from('pa_matter_policies').insert({ matter_id: matterId, policy_id: policyId, role: 'subject' })
    if (error) { toast.error(error.message); return }
    refetch()
  }

  const handleRunAnalysis = async () => {
    if (!matter.governing_state) {
      toast.error('Choose a governing state first.')
      return
    }
    if (attachedPolicyIds.size === 0) {
      toast.error('Attach at least one policy first.')
      return
    }
    setRunning(true)
    try {
      const result = await runAllocationAnalysis(matterId)
      toast.success('Analysis complete.')
      qc.invalidateQueries({ queryKey: ['pa_matter', matterId] })
      if (result?.analysisId) {
        navigate(`/matters/${matterId}/analysis/${result.analysisId}`)
      }
    } catch (e) {
      toast.error(e.message || 'Analysis failed.')
    } finally {
      setRunning(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto">
      <Link to="/matters" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matters
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{matter.name}</h1>
          <p className="text-slate-600 mt-1">Coverage matter</p>
        </div>
        <button onClick={handleRunAnalysis} disabled={running} className="btn-primary">
          <Sparkles className="h-4 w-4" />
          {running ? 'Running…' : 'Run allocation analysis'}
        </button>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Loss</div>
          <div className="space-y-3">
            <Select label="Loss type" value={matter.loss_type} onChange={v => updateMatter({ loss_type: v })}
              options={[
                { value: '',                label: '—' },
                { value: 'environmental',   label: 'Environmental / pollution' },
                { value: 'construction_defect', label: 'Construction defect' },
                { value: 'product_liability',   label: 'Product liability' },
                { value: 'asbestos',            label: 'Asbestos / mass tort' },
                { value: 'professional',        label: 'Professional / E&O' },
                { value: 'cyber',               label: 'Cyber / data breach' },
                { value: 'auto',                label: 'Auto' },
                { value: 'general_liability',   label: 'General liability — single occurrence' },
                { value: 'other',               label: 'Other' },
              ]}
            />
            <Input label="Loss start date" type="date" value={matter.loss_start_date || ''} onChange={v => updateMatter({ loss_start_date: v || null })} />
            <Input label="Loss end date"   type="date" value={matter.loss_end_date   || ''} onChange={v => updateMatter({ loss_end_date:   v || null })} />
            <Input label="Damages exposure ($)" type="number" value={matter.damages_exposure || ''}
              onChange={v => updateMatter({ damages_exposure: v ? Number(v) : null })} />
          </div>
        </div>

        <div className="card p-5">
          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">Jurisdictions</div>
          <div className="space-y-3">
            <StateSelect label="Suit venue state" value={matter.venue_state} onChange={v => updateMatter({ venue_state: v })} />
            <StateSelect label="Insured HQ state" value={matter.insured_hq_state} onChange={v => updateMatter({ insured_hq_state: v })} />
            <StateSelect label="Governing state (controlling law)" value={matter.governing_state}
              onChange={v => updateMatter({ governing_state: v })}
              hint={matter.governing_state && STATE_RULES[matter.governing_state]?.notes}
            />
          </div>

          {candidates.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-100">
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Candidate jurisdictions</div>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map(c => (
                  <button
                    key={c.code}
                    onClick={() => updateMatter({ governing_state: c.code })}
                    className={`badge cursor-pointer ${
                      matter.governing_state === c.code
                        ? 'bg-brand-600 text-white'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {c.code} · {c.rule.defaultMethod.replaceAll('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Policies on this matter</h2>
          <span className="text-xs text-slate-500">{attachedPolicyIds.size} attached</span>
        </div>
        {(matter.pa_matter_policies || []).length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No policies attached. Add some below.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100 text-left text-xs uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Carrier</th>
                <th className="px-4 py-2.5 font-semibold">Policy #</th>
                <th className="px-4 py-2.5 font-semibold">Period</th>
                <th className="px-4 py-2.5 font-semibold">Role</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {matter.pa_matter_policies.map(mp => (
                <tr key={mp.policy_id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/policies/${mp.policy_id}`} className="text-brand-700 hover:text-brand-800 font-medium">
                      {mp.pa_policies?.carrier || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{mp.pa_policies?.policy_number || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {mp.pa_policies?.effective_date && mp.pa_policies?.expiration_date
                      ? `${mp.pa_policies.effective_date} → ${mp.pa_policies.expiration_date}`
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">{mp.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="px-5 py-4 border-t border-slate-100">
          <AttachPolicyControl
            policies={orgPolicies.filter(p => !attachedPolicyIds.has(p.id))}
            onAttach={attachPolicy}
          />
        </div>
      </div>

      <div className="card">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Analyses</h2>
        </div>
        {(matter.pa_analyses || []).length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No analyses yet. Run one above when you've attached policies and chosen a governing state.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matter.pa_analyses.map(a => (
              <li key={a.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50">
                <Link to={`/matters/${matterId}/analysis/${a.id}`} className="flex-1">
                  <div className="font-medium text-slate-900">{a.governing_state} · {a.allocation_method?.replaceAll('_', ' ')}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{new Date(a.created_at).toLocaleString()}</div>
                </Link>
                <span className={`badge ${a.status === 'complete' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <input type={type} className="form-input" value={value || ''} onChange={e => onChange(e.target.value)} />
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={value || ''} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]

function StateSelect({ label, value, onChange, hint }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={value || ''} onChange={e => onChange(e.target.value || null)}>
        <option value="">—</option>
        {ALL_STATES.map(s => <option key={s} value={s}>{s} {STATE_RULES[s] ? `· ${STATE_RULES[s].name}` : ''}</option>)}
      </select>
      {hint && <p className="text-xs text-slate-500 mt-1">{hint}</p>}
    </div>
  )
}

function AttachPolicyControl({ policies, onAttach }) {
  const [open, setOpen] = useState(false)
  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-secondary">
        <Plus className="h-4 w-4" /> Attach policy
      </button>
    )
  }
  if (policies.length === 0) {
    return <p className="text-sm text-slate-500">All your indexed policies are already attached. <Link to="/policies/upload" className="text-brand-700 hover:text-brand-800">Upload more →</Link></p>
  }
  return (
    <div className="flex gap-3">
      <select
        autoFocus
        className="form-input flex-1"
        onChange={e => { if (e.target.value) onAttach(e.target.value) }}
        defaultValue=""
      >
        <option value="" disabled>Choose a policy…</option>
        {policies.map(p => (
          <option key={p.id} value={p.id}>
            {p.carrier || 'Untitled'} · {p.policy_number || ''} · {p.effective_date || ''}–{p.expiration_date || ''}
          </option>
        ))}
      </select>
      <button onClick={() => setOpen(false)} className="btn-secondary">Done</button>
    </div>
  )
}
