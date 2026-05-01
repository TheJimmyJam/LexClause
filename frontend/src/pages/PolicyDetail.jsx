import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw, FileText } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { extractPolicyTerms } from '../lib/policyAnalysis.js'
import toast from 'react-hot-toast'

export default function PolicyDetail() {
  const { policyId } = useParams()

  const { data: policy, refetch } = useQuery({
    queryKey: ['lc_policy', policyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('lc_policies').select('*').eq('id', policyId).single()
      if (error) throw error
      return data
    }
  })

  const handleRetryExtraction = async () => {
    try {
      await supabase.from('lc_policies').update({ extraction_status: 'extracting' }).eq('id', policyId)
      await extractPolicyTerms(policyId)
      toast.success('Re-extraction queued.')
      refetch()
    } catch (e) {
      toast.error(e.message)
    }
  }

  if (!policy) {
    return <div className="p-10 text-center text-slate-500">Loading…</div>
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto">
      <Link to="/policies" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to policies
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{policy.carrier || policy.source_filename || 'Untitled policy'}</h1>
          <p className="text-slate-600 mt-1 font-mono text-sm">{policy.policy_number || '—'}</p>
        </div>
        <button onClick={handleRetryExtraction} className="btn-secondary">
          <RefreshCw className="h-4 w-4" /> Re-run extraction
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-8">
        <Field label="Named insured" value={policy.named_insured} />
        <Field label="State issued"  value={policy.state_issued} />
        <Field label="Effective"     value={policy.effective_date} />
        <Field label="Expires"       value={policy.expiration_date} />
        <Field label="Policy form"   value={policy.policy_form} />
        <Field label="Status"        value={policy.extraction_status} />
        <Field label="Per-occurrence limit" value={fmtMoney(policy.per_occurrence_limit)} />
        <Field label="General aggregate"    value={fmtMoney(policy.general_aggregate)} />
        <Field label="SIR / Deductible"     value={fmtMoney(policy.self_insured_retention || policy.deductible)} />
      </div>

      <Section title="Other-insurance clause">
        <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
          {policy.other_insurance_clause || <span className="text-slate-400 italic">Not yet extracted.</span>}
        </pre>
        {policy.other_insurance_type && (
          <span className="badge bg-brand-100 text-brand-800 mt-3">{policy.other_insurance_type}</span>
        )}
      </Section>

      <Section title="Other-insurance / priority language" className="mt-6">
        <pre className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed">
          {policy.allocation_method_text || <span className="text-slate-400 italic">No explicit Other Insurance or priority language found.</span>}
        </pre>
      </Section>

      <Section title="Source PDF" className="mt-6">
        <p className="text-sm text-slate-600 inline-flex items-center gap-2">
          <FileText className="h-4 w-4 text-slate-400" />
          {policy.source_filename || policy.source_storage_path}
        </p>
      </Section>
    </div>
  )
}

function Field({ label, value }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-1">{label}</div>
      <div className="text-slate-900 text-sm">{value || <span className="text-slate-400">—</span>}</div>
    </div>
  )
}

function Section({ title, children, className = '' }) {
  return (
    <div className={`card p-5 ${className}`}>
      <div className="text-xs uppercase tracking-wide text-slate-500 font-semibold mb-3">{title}</div>
      {children}
    </div>
  )
}

function fmtMoney(n) {
  if (n == null || n === '') return null
  return `$${Number(n).toLocaleString()}`
}
