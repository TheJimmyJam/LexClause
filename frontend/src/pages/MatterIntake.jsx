import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import {
  ArrowLeft, Upload, Loader2, FileText, AlertTriangle,
  CheckCircle2, Sparkles, Building2,
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { extractMatterFromDocument } from '../lib/policyAnalysis.js'
import toast from 'react-hot-toast'

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'
]
const LOSS_TYPES = [
  ['', '—'],
  ['environmental',       'Environmental / pollution'],
  ['construction_defect', 'Construction defect'],
  ['product_liability',   'Product liability'],
  ['asbestos',            'Asbestos / mass tort'],
  ['professional',        'Professional / E&O'],
  ['cyber',               'Cyber / data breach'],
  ['auto',                'Auto'],
  ['general_liability',   'General liability'],
  ['property',            'Property'],
  ['d&o',                 'D&O'],
  ['other',               'Other'],
]

export default function MatterIntake() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  // Two-phase UI: 'upload' → 'review' → (auto-redirect on save)
  const [phase, setPhase]       = useState('upload')
  const [busy, setBusy]         = useState(false)
  const [status, setStatus]     = useState('') // brief progress text
  const [storagePath, setStoragePath] = useState(null)
  const [filename, setFilename] = useState(null)
  const [extracted, setExtracted] = useState(null) // raw Claude parse, kept for raw_intake_extraction
  const [form, setForm]         = useState(null)   // editable matter form

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: false,
    onDrop: async (files) => {
      if (!profile?.org_id) { toast.error('No organization on profile.'); return }
      const file = files[0]
      if (!file) return
      setBusy(true)
      try {
        // 1. Upload PDF to lc-matter-docs
        setStatus('Uploading document…')
        const sp = `${profile.org_id}/${Date.now()}-${file.name}`
        const { error: upErr } = await supabase.storage
          .from('lc-matter-docs')
          .upload(sp, file, { contentType: 'application/pdf' })
        if (upErr) throw upErr
        setStoragePath(sp); setFilename(file.name)

        // 2. Invoke extract_matter on the edge function
        setStatus('Reading the document and pulling out the matter facts…')
        const result = await extractMatterFromDocument(sp)
        const p = result?.parsed
        if (!p) throw new Error('No parsed result returned.')
        setExtracted(p)

        // 3. Seed editable form from the extraction
        setForm({
          name:                 p.matter_name || (p.named_insured ? `${p.named_insured} matter` : 'New matter'),
          description:          p.description || '',
          loss_type:            p.loss_type || '',
          loss_start_date:      p.loss_start_date || '',
          loss_end_date:        p.loss_end_date || '',
          damages_exposure:     typeof p.damages_exposure === 'number' ? String(p.damages_exposure) : '',
          venue_state:          p.venue_state || '',
          insured_hq_state:     p.insured_hq_state || '',
          loss_location_states: Array.isArray(p.loss_location_states) ? p.loss_location_states.join(', ') : '',
        })

        setPhase('review')
      } catch (e) {
        console.error(e)
        toast.error(e.message || 'Extraction failed.')
      } finally {
        setBusy(false); setStatus('')
      }
    }
  })

  const update = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form || !profile?.org_id) return
    if (!form.name.trim()) { toast.error('Matter needs a name.'); return }
    setBusy(true)
    try {
      const locStates = form.loss_location_states
        .split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      const payload = {
        org_id:                profile.org_id,
        name:                  form.name.trim(),
        description:           form.description || null,
        loss_type:             form.loss_type || null,
        loss_start_date:       form.loss_start_date || null,
        loss_end_date:         form.loss_end_date   || null,
        damages_exposure:      form.damages_exposure ? Number(form.damages_exposure) : null,
        venue_state:           form.venue_state || null,
        insured_hq_state:      form.insured_hq_state || null,
        loss_location_states:  locStates,
        // Source metadata
        source_document_filename: filename,
        source_document_path:     storagePath,
        source_document_type:     extracted?.document_type || null,
        raw_intake_extraction:    extracted || null,
      }
      const { data, error } = await supabase.from('lc_matters').insert(payload).select().single()
      if (error) throw error
      toast.success('Matter created from document.')
      navigate(`/matters/${data.id}`)
    } catch (e) {
      toast.error(e.message || 'Failed to create matter.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <Link to="/matters" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to matters
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">Create matter from a document</h1>
      <p className="text-slate-600 mb-8">
        Drop in an FNOL, reservation-of-rights letter, claim summary, or complaint. Claude reads it and pre-fills the matter — you review and confirm.
      </p>

      {phase === 'upload' && (
        <>
          <div
            {...getRootProps()}
            className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-colors ${
              isDragActive ? 'border-brand-500 bg-brand-50/50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="h-10 w-10 text-slate-400 mx-auto mb-4" />
            {busy ? (
              <div className="flex flex-col items-center gap-2 text-brand-700">
                <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> {status || 'Working…'}</div>
              </div>
            ) : (
              <>
                <p className="font-medium text-slate-900">Drop a PDF here or click to choose</p>
                <p className="text-sm text-slate-500 mt-1">FNOL · ROR letter · claim summary · complaint · demand letter</p>
              </>
            )}
          </div>

          <div className="mt-6 grid sm:grid-cols-2 gap-3 text-xs text-slate-500">
            <Tip icon={CheckCircle2} text="Insured name, claim number, parties extracted automatically" />
            <Tip icon={CheckCircle2} text="Loss type, dates, jurisdictions, exposure pulled from the document" />
            <Tip icon={CheckCircle2} text="Carriers and policy numbers identified for follow-up attachment" />
            <Tip icon={CheckCircle2} text="You always review and edit before the matter is created" />
          </div>
        </>
      )}

      {phase === 'review' && form && (
        <ReviewForm
          form={form}
          extracted={extracted}
          filename={filename}
          update={update}
          onBack={() => setPhase('upload')}
          onSave={handleSave}
          busy={busy}
        />
      )}
    </div>
  )
}

function Tip({ icon: Icon, text }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-3.5 w-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
      <span>{text}</span>
    </div>
  )
}

function ReviewForm({ form, extracted, filename, update, onBack, onSave, busy }) {
  const carriers = Array.isArray(extracted?.carriers_mentioned) ? extracted.carriers_mentioned : []
  const docType = (extracted?.document_type || 'document').replaceAll('_', ' ')

  return (
    <>
      {/* Source banner */}
      <div className="card p-4 mb-6 border-emerald-200/60 bg-emerald-50/40">
        <div className="flex items-start gap-3">
          <Sparkles className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-medium text-emerald-900">
              Extracted from <span className="font-mono text-xs">{filename}</span>
            </div>
            <p className="text-xs text-emerald-800 mt-0.5">
              Detected as a <strong>{docType}</strong>. Review the fields below — every value is editable.
            </p>
          </div>
        </div>
      </div>

      {/* Editable form */}
      <div className="card p-6 mb-6">
        <h2 className="font-semibold text-slate-900 mb-4">Matter details</h2>
        <div className="space-y-4">
          <div>
            <label className="form-label">Matter name</label>
            <input className="form-input" value={form.name} onChange={e => update('name', e.target.value)} />
          </div>
          <div>
            <label className="form-label">Description</label>
            <textarea
              className="form-input min-h-[6rem]"
              value={form.description}
              onChange={e => update('description', e.target.value)}
            />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <Select label="Loss type" value={form.loss_type} onChange={v => update('loss_type', v)}
              options={LOSS_TYPES.map(([v, l]) => ({ value: v, label: l }))} />
            <Input label="Damages exposure ($)" type="number" value={form.damages_exposure}
              onChange={v => update('damages_exposure', v)} />
            <Input label="Loss start date" type="date" value={form.loss_start_date}
              onChange={v => update('loss_start_date', v)} />
            <Input label="Loss end date" type="date" value={form.loss_end_date}
              onChange={v => update('loss_end_date', v)} />
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            <StateSelect label="Suit venue state" value={form.venue_state} onChange={v => update('venue_state', v)} />
            <StateSelect label="Insured HQ state" value={form.insured_hq_state} onChange={v => update('insured_hq_state', v)} />
          </div>
          <div>
            <label className="form-label">Loss location states (comma-separated, e.g. TX, NY)</label>
            <input className="form-input font-mono text-sm uppercase" value={form.loss_location_states}
              onChange={e => update('loss_location_states', e.target.value)} />
          </div>
        </div>
      </div>

      {/* Carriers mentioned (read-only — they'll be attached after the matter is created) */}
      {carriers.length > 0 && (
        <div className="card p-5 mb-6">
          <div className="flex items-start gap-3 mb-3">
            <Building2 className="h-5 w-5 text-brand-700 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-slate-900">Carriers mentioned in the document</h3>
              <p className="text-xs text-slate-600 mt-0.5">Attach the matching policies after the matter is created. If a policy isn't in your library yet, upload it on the Policies page first.</p>
            </div>
          </div>
          <ul className="divide-y divide-slate-100">
            {carriers.map((c, i) => (
              <li key={i} className="py-2.5 flex items-center gap-3 text-sm">
                <span className="font-medium text-slate-900 flex-1">{c.carrier || '—'}</span>
                {c.policy_number && <span className="text-slate-600 font-mono text-xs">{c.policy_number}</span>}
                {c.role && <span className="badge bg-slate-100 text-slate-700 text-[10px]">{c.role}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={onBack} className="btn-secondary" disabled={busy}>Back</button>
        <button onClick={onSave} disabled={busy} className="btn-primary">
          <FileText className="h-4 w-4" />
          {busy ? 'Creating…' : 'Create matter'}
        </button>
      </div>

      {/* Honest disclaimer */}
      <p className="text-xs text-slate-500 mt-6 inline-flex items-start gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
        Extraction is a draft. Always verify against the source document before relying on these values for an allocation analysis.
      </p>
    </>
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
function StateSelect({ label, value, onChange }) {
  return (
    <div>
      <label className="form-label">{label}</label>
      <select className="form-input" value={value || ''} onChange={e => onChange(e.target.value || '')}>
        <option value="">—</option>
        {ALL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  )
}
