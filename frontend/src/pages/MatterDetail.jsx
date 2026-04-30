import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Sparkles, Plus, GitCompareArrows, X } from 'lucide-react'
import { useState } from 'react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { runAllocationAnalysis, runComparison } from '../lib/policyAnalysis.js'
import { STATE_RULES, candidateJurisdictions } from '../lib/stateLaw.js'
import toast from 'react-hot-toast'

export default function MatterDetail() {
  const { matterId } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: matter, refetch } = useQuery({
    queryKey: ['lc_matter', matterId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_matters')
        .select('*, lc_matter_policies(policy_id, role, lc_policies(*)), lc_analyses(*)')
        .eq('id', matterId)
        .single()
      if (error) throw error
      return data
    }
  })

  const { data: orgPolicies = [] } = useQuery({
    queryKey: ['lc_policies', profile?.org_id, 'for-attach'],
    enabled: !!profile?.org_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_policies')
        .select('id, carrier, policy_number, effective_date, expiration_date')
        .eq('org_id', profile.org_id)
      if (error) throw error
      return data
    }
  })

  const [running, setRunning] = useState(false)
  const [compareOpen, setCompareOpen] = useState(false)

  if (!matter) return <div className="p-10 text-center text-slate-500">Loading…</div>

  const attachedPolicies = (matter.lc_matter_policies || []).map(mp => mp.lc_policies).filter(Boolean)
  const attachedPolicyIds = new Set((matter.lc_matter_policies || []).map(mp => mp.policy_id))
  const targetedSet = new Set(matter.targeted_carriers || [])
  const stateAllowsTarget = !!STATE_RULES[matter.governing_state]?.targetedTenderAllowed

  const candidates = candidateJurisdictions({
    policyIssuedStates: (matter.lc_matter_policies || []).map(mp => mp.lc_policies?.state_issued).filter(Boolean),
    matterVenueState:   matter.venue_state,
    insuredHQState:     matter.insured_hq_state,
    lossLocationStates: matter.loss_location_states || [],
  })

  const updateMatter = async (patch) => {
    const { error } = await supabase.from('lc_matters').update(patch).eq('id', matterId)
    if (error) { toast.error(error.message); return }
    refetch()
  }

  const toggleTargeted = (policyId) => {
    const next = targetedSet.has(policyId)
      ? [...targetedSet].filter(id => id !== policyId)
      : [...targetedSet, policyId]
    return updateMatter({ targeted_carriers: next })
  }
  const clearTargeting = () => updateMatter({ targeted_carriers: [] })

  const attachPolicy = async (policyId) => {
    const { error } = await supabase.from('lc_matter_policies').insert({ matter_id: matterId, policy_id: policyId, role: 'subject' })
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
      // The edge function returns immediately with analysisId; the actual
      // Claude work continues in the background. We navigate to the analysis
      // page right away — it polls for status until 'complete' or 'failed'.
      qc.invalidateQueries({ queryKey: ['lc_matter', matterId] })
      if (result?.analysisId) {
        toast.success('Analysis started — running in the background.')
        navigate(`/matters/${matterId}/analysis/${result.analysisId}`)
      } else {
        toast.error('Analysis failed to start.')
      }
    } catch (e) {
      toast.error(e.message || 'Analysis failed to start.')
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
        <div className="flex items-center gap-2">
          <button onClick={() => setCompareOpen(true)} disabled={attachedPolicyIds.size === 0} className="btn-secondary">
            <GitCompareArrows className="h-4 w-4" />
            Compare jurisdictions
          </button>
          <button onClick={handleRunAnalysis} disabled={running} className="btn-primary">
            <Sparkles className="h-4 w-4" />
            {running ? 'Running…' : 'Run allocation'}
          </button>
        </div>
      </div>

      {compareOpen && (
        <CompareModal
          matter={matter}
          candidates={candidates}
          attached={attachedPolicies}
          onClose={() => setCompareOpen(false)}
          onLaunched={(comparisonGroupId) => {
            navigate(`/matters/${matterId}/compare/${comparisonGroupId}`)
          }}
        />
      )}

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

      {stateAllowsTarget && attachedPolicies.length > 0 && (
        <div className="card p-5 mb-6 border-amber-200/70 bg-amber-50/30">
          <div className="flex items-start justify-between mb-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-800 font-semibold">Targeted tender</div>
              <p className="text-sm text-slate-700 mt-1">
                <strong>{matter.governing_state}</strong> allows the insured to selectively tender to specific carriers.
                Untargeted carriers will be allocated <strong>$0</strong> and the engine will document why.
                Leave all unchecked to fall back to {STATE_RULES[matter.governing_state]?.name}'s default rule.
              </p>
            </div>
            {targetedSet.size > 0 && (
              <button onClick={clearTargeting} className="text-xs text-amber-800 hover:text-amber-900 font-medium underline whitespace-nowrap ml-3">
                Clear targeting
              </button>
            )}
          </div>
          <div className="space-y-1.5">
            {attachedPolicies.map(p => {
              const checked = targetedSet.has(p.id)
              return (
                <label key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-amber-100/60 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTargeted(p.id)}
                    className="h-4 w-4 rounded border-amber-400 text-amber-600 focus:ring-amber-500"
                  />
                  <div className="flex-1 text-sm">
                    <span className="font-medium text-slate-900">{p.carrier || 'Untitled carrier'}</span>
                    <span className="text-slate-500 ml-2 font-mono text-xs">{p.policy_number || '—'}</span>
                    {p.effective_date && p.expiration_date && (
                      <span className="text-slate-500 text-xs ml-2">{p.effective_date} → {p.expiration_date}</span>
                    )}
                  </div>
                  {checked && <span className="badge bg-amber-200 text-amber-900">Targeted</span>}
                </label>
              )
            })}
          </div>
          {targetedSet.size > 0 && (
            <p className="text-xs text-amber-800 mt-3">
              Tendered to <strong>{targetedSet.size}</strong> of {attachedPolicies.length} carriers. The engine will allocate $0 to the remaining {attachedPolicies.length - targetedSet.size}.
            </p>
          )}
        </div>
      )}

      <div className="card mb-6">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900">Policies on this matter</h2>
          <span className="text-xs text-slate-500">{attachedPolicyIds.size} attached</span>
        </div>
        {(matter.lc_matter_policies || []).length === 0 ? (
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
              {matter.lc_matter_policies.map(mp => (
                <tr key={mp.policy_id}>
                  <td className="px-4 py-2.5">
                    <Link to={`/policies/${mp.policy_id}`} className="text-brand-700 hover:text-brand-800 font-medium">
                      {mp.lc_policies?.carrier || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{mp.lc_policies?.policy_number || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-600 text-xs">
                    {mp.lc_policies?.effective_date && mp.lc_policies?.expiration_date
                      ? `${mp.lc_policies.effective_date} → ${mp.lc_policies.expiration_date}`
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
        {(matter.lc_analyses || []).length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-sm">No analyses yet. Run one above when you've attached policies and chosen a governing state.</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {matter.lc_analyses.map(a => (
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

function CompareModal({ matter, candidates, attached, onClose, onLaunched }) {
  // Default selection: candidate jurisdictions if any (capped at 4), else current governing state + 2 more from the candidates pool
  const seed = candidates.map(c => c.code).slice(0, 4)
  const [selected, setSelected] = useState(new Set(seed))
  const [launching, setLaunching] = useState(false)

  const toggle = (code) => {
    const next = new Set(selected)
    next.has(code) ? next.delete(code) : next.add(code)
    setSelected(next)
  }

  // Pool of states to choose from: union of candidates + all states with seeded rules
  const seededStates = Object.keys(STATE_RULES).filter(c => STATE_RULES[c])
  const candidateCodes = new Set(candidates.map(c => c.code))
  const otherStates = seededStates.filter(s => !candidateCodes.has(s))

  const handleLaunch = async () => {
    if (selected.size < 2) {
      toast.error('Pick at least 2 jurisdictions to compare.')
      return
    }
    if (selected.size > 5) {
      toast.error('5 jurisdictions max — narrows the search and keeps the comparison readable.')
      return
    }
    if (!matter.damages_exposure) {
      toast.error('Set damages exposure on the matter before comparing.')
      return
    }
    if (attached.length === 0) {
      toast.error('Attach at least one policy first.')
      return
    }
    setLaunching(true)
    try {
      const result = await runComparison(matter.id, [...selected])
      if (result?.comparisonGroupId) {
        toast.success(`Comparing ${selected.size} jurisdictions in parallel…`)
        onLaunched(result.comparisonGroupId)
      } else {
        toast.error('Comparison failed to start.')
      }
    } catch (e) {
      toast.error(e.message || 'Comparison failed to start.')
    } finally {
      setLaunching(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto shadow-modal" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between px-6 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-900">Compare jurisdictions</h2>
            <p className="text-xs text-slate-500 mt-1">Run the same matter under multiple states' allocation rules side-by-side. Pick 2–5.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-5">
          {candidates.length > 0 && (
            <>
              <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Candidates from this matter's facts</div>
              <div className="grid sm:grid-cols-2 gap-2 mb-5">
                {candidates.map(c => (
                  <StateChoice key={c.code} code={c.code} rule={c.rule} checked={selected.has(c.code)} onToggle={toggle} highlighted />
                ))}
              </div>
            </>
          )}

          <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-2">Other catalogued states</div>
          <div className="grid sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto pr-1">
            {otherStates.map(code => (
              <StateChoice key={code} code={code} rule={STATE_RULES[code]} checked={selected.has(code)} onToggle={toggle} />
            ))}
          </div>
        </div>

        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-500">{selected.size} selected · {selected.size >= 2 ? 'Ready' : 'Pick at least 2'}</p>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Cancel</button>
            <button onClick={handleLaunch} disabled={launching || selected.size < 2} className="btn-primary">
              <GitCompareArrows className="h-4 w-4" />
              {launching ? 'Launching…' : `Compare ${selected.size} jurisdictions`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function StateChoice({ code, rule, checked, onToggle, highlighted }) {
  return (
    <label className={`flex items-start gap-3 p-2.5 rounded-lg cursor-pointer border transition-colors ${
      checked ? 'bg-brand-50 border-brand-300' : highlighted ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-100/60' : 'bg-white border-slate-200 hover:bg-slate-50'
    }`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(code)}
        className="h-4 w-4 mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-900">{code} · {rule?.name || code}</div>
        <div className="text-[11px] text-slate-500 truncate">{(rule?.defaultMethod || '').replaceAll('_', ' ')}</div>
      </div>
    </label>
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
