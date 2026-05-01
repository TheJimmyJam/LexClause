/**
 * Analyzer — the single-input "drop everything" page that IS the product.
 *
 * Flow:
 *   1. User drags/drops any number of PDFs (policies of any kind + a complaint
 *      / pre-suit demand / ROR / claim summary).
 *   2. Each file uploads to lc-matter-docs and is auto-classified
 *      (classify_document mode).
 *   3. User can override any auto-classification before running the analysis.
 *   4. Click "Analyze" → we create a matter, move policy files into the
 *      lc-policies bucket, run extract_terms on each policy + extract_allegations
 *      on the trigger document, then run coverage_priority.
 *   5. The resulting Trigger / Priority / Exhaustion opinion renders inline
 *      with download buttons. No "dashboard," no library to manage.
 */

import { useState, useEffect, useRef } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, FileText, Loader2, CheckCircle2, AlertTriangle, X, XCircle,
  Sparkles, Scale, ChevronDown, Plus,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import {
  classifyDocument,
  extractAllegations,
  extractPolicyTerms,
  runCoveragePriority,
  runCoveragePriorityComparison,
} from '../lib/policyAnalysis.js'
import { SingleStateResult, ComparisonResult } from '../components/AnalysisView.jsx'

const ALL_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME',
  'MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI',
  'SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
]

const KIND_LABELS = {
  policy:           'Policy',
  complaint:        'Complaint',
  petition:         'Petition',
  demand_letter:    'Pre-suit demand',
  ror_letter:       'Reservation of rights',
  claim_summary:    'Claim summary',
  fnol:             'FNOL',
  other:            'Other',
}
const KIND_COLORS = {
  policy:        'bg-emerald-100 text-emerald-800 border-emerald-200',
  complaint:     'bg-purple-100 text-purple-800 border-purple-200',
  petition:      'bg-purple-100 text-purple-800 border-purple-200',
  demand_letter: 'bg-amber-100 text-amber-800 border-amber-200',
  ror_letter:    'bg-rose-100 text-rose-800 border-rose-200',
  claim_summary: 'bg-sky-100 text-sky-800 border-sky-200',
  fnol:          'bg-sky-100 text-sky-800 border-sky-200',
  other:         'bg-slate-100 text-slate-700 border-slate-200',
}
const POLICY_FORM_LABELS = {
  CGL_OCCURRENCE:      'CGL (Occurrence)',
  CGL_CLAIMS_MADE:     'CGL (Claims-Made)',
  UMBRELLA:            'Umbrella',
  EXCESS:              'Excess',
  PROFESSIONAL:        'Professional / E&O',
  POLLUTION_CONTRACTOR:"Contractor's Pollution",
  POLLUTION_SITE:      'Site Pollution',
  BUILDERS_RISK:       "Builder's Risk",
  'D&O':               'D&O',
  PROPERTY:            'Property',
  OTHER:               'Other',
}
const TRIGGER_KINDS = new Set(['complaint','petition','demand_letter','ror_letter','claim_summary','fnol'])

export default function Analyzer() {
  const { profile } = useAuth()

  // Files: each entry is { id, file, status, storagePath, classification, error, kindOverride, formOverride }
  const [files, setFiles]                       = useState([])
  const [governingState, setGoverningState]     = useState('')
  const [comparisonStates, setComparisonStates] = useState([])
  const [phase, setPhase]                       = useState('input')   // input | running | done | failed
  const [matterId, setMatterId]                 = useState(null)
  const [analysisId, setAnalysisId]             = useState(null)
  const [comparisonGroupId, setComparisonGroupId] = useState(null)
  const [analysis, setAnalysis]                 = useState(null)      // single-state coverage_priority result
  const [comparison, setComparison]             = useState([])        // multi-state results
  const [progress, setProgress]                 = useState({ steps: [], detail: '' })
  const [errorMessage, setErrorMessage]         = useState('')

  // ── Progress helpers (real, event-driven) ────────────────────────────────
  function initProgress(numPolicies, numStates) {
    setProgress({
      steps: [
        { id: 'matter',      label: 'Creating matter',                                                              status: 'pending' },
        { id: 'allegations', label: 'Extracting allegations from trigger document',                                 status: 'pending' },
        { id: 'upload',      label: `Preparing ${numPolicies} polic${numPolicies === 1 ? 'y' : 'ies'}`,             status: 'pending' },
        { id: 'extract',     label: 'Parsing policy terms',                                                         status: 'pending' },
        { id: 'analysis',    label: numStates > 1 ? `Running ${numStates}-jurisdiction comparison` : 'Running priority analysis',  status: 'pending' },
        { id: 'finalize',    label: 'Drafting opinion',                                                             status: 'pending' },
      ],
      detail: '',
    })
  }
  function updateStep(id, status, detail) {
    setProgress(p => ({
      steps: p.steps.map(s => s.id === id ? { ...s, status } : s),
      detail: detail !== undefined ? detail : p.detail,
    }))
  }

  // ── Dropzone ─────────────────────────────────────────────────────────────
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    disabled: phase !== 'input',
    onDrop: (newFiles) => handleNewFiles(newFiles),
  })

  async function handleNewFiles(newFiles) {
    if (!profile?.org_id) { toast.error('No organization on profile.'); return }
    for (const file of newFiles) {
      const id = crypto.randomUUID()
      setFiles(prev => [...prev, { id, file, status: 'uploading' }])
      const path = `${profile.org_id}/${Date.now()}-${id.slice(0, 8)}-${file.name}`
      try {
        const { error: upErr } = await supabase.storage
          .from('lc-matter-docs')
          .upload(path, file, { contentType: 'application/pdf' })
        if (upErr) throw upErr
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'classifying', storagePath: path } : f))

        const c = await classifyDocument(path, 'lc-matter-docs')
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'ready', classification: c } : f))

        // Auto-detect governing state from the first trigger doc with a venue
        if (TRIGGER_KINDS.has(c?.kind) && c?.venue_state && !governingState) {
          setGoverningState(c.venue_state)
        }
      } catch (e) {
        setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'error', error: String(e?.message || e) } : f))
        toast.error(`${file.name}: ${e?.message || e}`)
      }
    }
  }

  function setOverrideKind(id, kind) {
    setFiles(prev => prev.map(f =>
      f.id === id ? { ...f, kindOverride: kind, formOverride: kind === 'policy' ? (f.formOverride || f.classification?.policy_form || 'OTHER') : null } : f))
  }
  function setOverrideForm(id, form) {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, formOverride: form } : f))
  }
  function removeFile(id) {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  // Retry a single file's classification — re-uploads if needed, then re-classifies.
  async function retryClassification(fileRecord) {
    const f = fileRecord
    if (!profile?.org_id) return
    setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'uploading', error: null } : x))
    try {
      let path = f.storagePath
      if (!path) {
        path = `${profile.org_id}/${Date.now()}-${f.id.slice(0, 8)}-${f.file.name}`
        const { error: upErr } = await supabase.storage
          .from('lc-matter-docs')
          .upload(path, f.file, { contentType: 'application/pdf' })
        if (upErr) throw upErr
      }
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'classifying', storagePath: path } : x))
      const c = await classifyDocument(path, 'lc-matter-docs')
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'ready', classification: c, error: null } : x))
      if (TRIGGER_KINDS.has(c?.kind) && c?.venue_state && !governingState) {
        setGoverningState(c.venue_state)
      }
    } catch (e) {
      setFiles(prev => prev.map(x => x.id === f.id ? { ...x, status: 'error', error: String(e?.message || e) } : x))
      toast.error(`${f.file.name}: ${e?.message || e}`)
    }
  }

  // Effective classification: override wins over auto
  function effectiveKind(f) { return f.kindOverride ?? f.classification?.kind ?? null }
  function effectiveForm(f) { return f.formOverride ?? f.classification?.policy_form ?? null }

  const policyFiles  = files.filter(f => effectiveKind(f) === 'policy' && f.status === 'ready')
  const triggerFile  = files.find(f => TRIGGER_KINDS.has(effectiveKind(f)) && f.status === 'ready')
  const otherFiles   = files.filter(f => !['policy', null, undefined].includes(effectiveKind(f)) && !TRIGGER_KINDS.has(effectiveKind(f)) && f.status === 'ready')
  const anyClassifying = files.some(f => f.status === 'uploading' || f.status === 'classifying')

  const canAnalyze =
    phase === 'input' &&
    !anyClassifying &&
    policyFiles.length >= 1 &&
    !!triggerFile &&
    !!governingState

  // ── Analyze ──────────────────────────────────────────────────────────────
  async function analyze() {
    if (!canAnalyze) return
    setPhase('running')
    setErrorMessage('')
    initProgress(policyFiles.length, comparisonStates.length || 1)
    try {
      // ── 1. Create the matter ────────────────────────────────────────────
      updateStep('matter', 'active')
      const { data: matter, error: matterErr } = await supabase
        .from('lc_matters')
        .insert({
          org_id:                   profile.org_id,
          name:                     'Untitled — ' + new Date().toLocaleDateString(),
          governing_state:          governingState,
          venue_state:              governingState,
          source_document_path:     triggerFile.storagePath,
          source_document_filename: triggerFile.file.name,
          source_document_type:     effectiveKind(triggerFile),
        })
        .select()
        .single()
      if (matterErr) throw matterErr
      setMatterId(matter.id)
      updateStep('matter', 'done')

      // ── 2. Extract allegations from the trigger doc ─────────────────────
      updateStep('allegations', 'active', triggerFile.file.name)
      await extractAllegations(triggerFile.storagePath, matter.id)
      updateStep('allegations', 'done', '')

      // ── 3. Copy each policy from lc-matter-docs → lc-policies, create rows ──
      updateStep('upload', 'active', `0 of ${policyFiles.length}`)
      const policies = []
      for (let i = 0; i < policyFiles.length; i++) {
        const pf = policyFiles[i]
        updateStep('upload', 'active', `${i + 1} of ${policyFiles.length} · ${pf.file.name}`)
        const { data: blob, error: dlErr } = await supabase.storage
          .from('lc-matter-docs')
          .download(pf.storagePath)
        if (dlErr) throw dlErr
        const newPath = `${profile.org_id}/${Date.now()}-${pf.id.slice(0, 8)}-${pf.file.name}`
        const { error: upErr } = await supabase.storage
          .from('lc-policies')
          .upload(newPath, blob, { contentType: 'application/pdf' })
        if (upErr) throw upErr
        const { data: pol, error: polErr } = await supabase
          .from('lc_policies')
          .insert({
            org_id:              profile.org_id,
            source_filename:     pf.file.name,
            source_storage_path: newPath,
            policy_form:         effectiveForm(pf) || 'OTHER',
            extraction_status:   'pending',
          })
          .select()
          .single()
        if (polErr) throw polErr
        policies.push(pol)
        await supabase.from('lc_matter_policies').insert({
          matter_id: matter.id,
          policy_id: pol.id,
          role:      'subject',
        })
      }
      updateStep('upload', 'done', '')

      // ── 4. extract_terms in parallel + wait for completion (live count) ──
      updateStep('extract', 'active', `0 of ${policies.length} parsed`)
      await Promise.all(policies.map(p => extractPolicyTerms(p.id).catch(e => {
        console.error('extract_terms failed', p.id, e)
      })))
      await waitForPolicyExtractions(
        policies.map(p => p.id),
        90_000,
        (done, total) => updateStep('extract', 'active', `${done} of ${total} parsed`),
      )
      updateStep('extract', 'done', '')

      // ── 5. Coverage_priority — single state or multi-state ──────────────
      updateStep('analysis', 'active', comparisonStates.length >= 2 ? 'kicking off jurisdictions in parallel' : 'engine running')
      if (comparisonStates.length >= 2) {
        const result = await runCoveragePriorityComparison(matter.id, comparisonStates)
        setComparisonGroupId(result.comparisonGroupId)
        await pollComparison(
          result.comparisonGroupId,
          (done, total) => updateStep('analysis', 'active', `${done} of ${total} jurisdictions complete`),
        )
      } else {
        const result = await runCoveragePriority(matter.id, { governingState })
        setAnalysisId(result.analysisId)
        await pollAnalysis(
          result.analysisId,
          (status) => updateStep('analysis', 'active', status),
        )
      }
      updateStep('analysis', 'done', '')
      updateStep('finalize', 'done', '')

      setPhase('done')
    } catch (e) {
      console.error('Analyze failed', e)
      const msg = e?.message || String(e)
      setErrorMessage(msg)
      toast.error(`Analysis failed: ${msg}`)
      setProgress(p => ({
        steps: p.steps.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s),
        detail: msg,
      }))
      setPhase('failed')
    }
  }

  // Resume from a sensible point after a failure. Most common case: the engine
  // step failed (Claude hiccup, network blip, validation couldn't reconcile).
  // The matter + policies already exist — we just re-fire coverage_priority.
  async function retry() {
    if (!matterId) {
      // No matter yet → nothing to resume; full restart
      return analyze()
    }
    setPhase('running')
    setErrorMessage('')
    setAnalysis(null)
    setComparison([])
    setComparisonGroupId(null)
    setAnalysisId(null)
    // Reset failed/pending steps; keep done steps marked done
    setProgress(p => ({
      steps: p.steps.map(s => s.status === 'failed' ? { ...s, status: 'pending' } : s),
      detail: '',
    }))
    try {
      // Mark anything not yet done as the retry path. We do NOT re-extract
      // allegations or re-upload policies — those are idempotent and already
      // happened. We just re-run the engine.
      // (If allegations actually failed before completion, the engine will
      // produce a sparse output rather than throw, which is the right fallback.)
      const remaining = ['allegations','upload','extract']
      for (const id of remaining) {
        // Anything not yet 'done', mark as 'done' (it succeeded before the
        // engine step, or we skip re-running it).
        const st = progress.steps.find(s => s.id === id)
        if (st && st.status !== 'done') updateStep(id, 'done', '')
      }

      updateStep('analysis', 'active', comparisonStates.length >= 2 ? 'kicking off jurisdictions in parallel' : 'engine running')
      if (comparisonStates.length >= 2) {
        const result = await runCoveragePriorityComparison(matterId, comparisonStates)
        setComparisonGroupId(result.comparisonGroupId)
        await pollComparison(
          result.comparisonGroupId,
          (done, total) => updateStep('analysis', 'active', `${done} of ${total} jurisdictions complete`),
        )
      } else {
        const result = await runCoveragePriority(matterId, { governingState })
        setAnalysisId(result.analysisId)
        await pollAnalysis(
          result.analysisId,
          (status) => updateStep('analysis', 'active', status),
        )
      }
      updateStep('analysis', 'done', '')
      updateStep('finalize', 'done', '')
      setPhase('done')
    } catch (e) {
      console.error('Retry failed', e)
      const msg = e?.message || String(e)
      setErrorMessage(msg)
      toast.error(`Retry failed: ${msg}`)
      setProgress(p => ({
        steps: p.steps.map(s => s.status === 'active' ? { ...s, status: 'failed' } : s),
        detail: msg,
      }))
      setPhase('failed')
    }
  }

  async function waitForPolicyExtractions(policyIds, timeoutMs = 60_000, onProgress) {
    const start = Date.now()
    while (Date.now() - start < timeoutMs) {
      const { data } = await supabase
        .from('lc_policies')
        .select('id, extraction_status')
        .in('id', policyIds)
      const done = (data || []).filter(p => p.extraction_status === 'complete' || p.extraction_status === 'failed').length
      onProgress?.(done, policyIds.length)
      if (done === policyIds.length) return
      await new Promise(r => setTimeout(r, 1500))
    }
  }

  async function pollAnalysis(id, onProgress) {
    const start = Date.now()
    while (Date.now() - start < 5 * 60_000) {
      const { data } = await supabase
        .from('lc_analyses')
        .select('*, lc_analysis_results(*), lc_matters(name)')
        .eq('id', id)
        .single()
      if (data?.validation_attempts && data.validation_attempts > 0 && data.status !== 'complete') {
        onProgress?.(`validating · attempt ${data.validation_attempts}/3`)
      } else if (data?.status === 'running' || data?.status === 'pending') {
        onProgress?.('engine running')
      }
      if (data?.status === 'failed') {
        // Throw so the surrounding try/catch surfaces a real failure state
        throw new Error(data.error || 'Engine returned a failed analysis')
      }
      if (data?.status === 'complete') {
        setAnalysis(data)
        return
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    throw new Error('Analysis timed out after 5 minutes')
  }

  async function pollComparison(groupId, onProgress) {
    const start = Date.now()
    while (Date.now() - start < 5 * 60_000) {
      const { data } = await supabase
        .from('lc_analyses')
        .select('*, lc_analysis_results(*)')
        .eq('comparison_group_id', groupId)
        .order('created_at', { ascending: true })
      const total = (data || []).length
      const done = (data || []).filter(a => a.status === 'complete' || a.status === 'failed').length
      onProgress?.(done, total)
      if (total > 0 && done === total) {
        setComparison(data)
        return
      }
      await new Promise(r => setTimeout(r, 2000))
    }
    throw new Error('Comparison timed out after 5 minutes')
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <ResultView
        analysis={analysis}
        comparison={comparison}
        comparisonGroupId={comparisonGroupId}
        onReset={() => location.reload()}
      />
    )
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* ── Header: logo lockup + serif title with brand underline ─────── */}
      <header className="mb-10">
        <div className="flex items-center gap-4 mb-5">
          <img
            src="/logo-icon.png"
            alt="LexClause"
            className="h-14 w-14 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1"
          />
          <div className="flex flex-col">
            <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">
              LexClause
            </span>
            <span className="text-xs text-slate-500 tracking-wide">Coverage priority engine</span>
          </div>
        </div>

        <h1 className="font-serif-brand text-5xl lg:text-6xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Coverage Priority</span>
          <br />
          <span className="text-slate-700">Analysis</span>
        </h1>

        <p
          className="text-slate-600 mt-7 text-lg max-w-2xl leading-relaxed tracking-wide"
          style={{ fontVariant: 'all-small-caps' }}
        >
          Drop your policies and the lawsuit. Get a citable{' '}
          <strong className="text-brand-700">Trigger</strong> /{' '}
          <strong className="text-brand-700">Priority</strong> /{' '}
          <strong className="text-brand-700">Exhaustion</strong>{' '}
          opinion under the controlling state's law.
        </p>
      </header>

      {/* ── Drop zone: marching alternating dashes + white-over-blue split fill ── */}
      <DropZone
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        phase={phase}
      />

      {/* Files */}
      {files.length > 0 && (
        <div className="space-y-3 mb-8">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
            Files ({files.length})
          </h2>
          {files.map(f => (
            <FileCard
              key={f.id}
              file={f}
              effectiveKind={effectiveKind(f)}
              effectiveForm={effectiveForm(f)}
              onSetKind={(k) => setOverrideKind(f.id, k)}
              onSetForm={(form) => setOverrideForm(f.id, form)}
              onRemove={() => removeFile(f.id)}
              onRetry={() => retryClassification(f)}
              disabled={phase !== 'input'}
            />
          ))}
        </div>
      )}

      {/* Controls panel — appears once at least one of each */}
      {policyFiles.length >= 1 && triggerFile && (
        <div className="card p-6 mb-6 bg-gradient-to-br from-brand-50/40 to-cyan-50/30 border-brand-200/60">
          <h2 className="font-semibold text-slate-900 mb-4 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-brand-600" />
            Ready to analyze
          </h2>

          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Governing state
              </label>
              <select
                value={governingState}
                onChange={(e) => setGoverningState(e.target.value)}
                disabled={phase !== 'input'}
                className="form-select w-full"
              >
                <option value="">— Select state —</option>
                {ALL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              {triggerFile?.classification?.venue_state && triggerFile.classification.venue_state !== governingState && (
                <p className="text-xs text-slate-500 mt-1">Venue detected in {triggerFile.classification.venue_state}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Compare under additional states (optional)
              </label>
              <MultiStateSelector
                states={comparisonStates}
                onChange={setComparisonStates}
                exclude={governingState}
                disabled={phase !== 'input'}
              />
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-brand-200/60 pt-4">
            <div className="text-xs text-slate-600">
              <strong>{policyFiles.length}</strong> polic{policyFiles.length === 1 ? 'y' : 'ies'} ·{' '}
              <strong>1</strong> trigger doc{otherFiles.length > 0 ? ` · ${otherFiles.length} other` : ''}
              {comparisonStates.length > 0 && ` · compare ${comparisonStates.length + 1} states`}
            </div>
            <button
              onClick={analyze}
              disabled={!canAnalyze}
              className="btn-primary"
            >
              {phase === 'running' ? <><Loader2 className="h-4 w-4 animate-spin" /> Analyzing…</> : <><Scale className="h-4 w-4" /> Run analysis</>}
            </button>
          </div>
        </div>
      )}

      {phase === 'running' && <RunningOverlay progress={progress} />}

      {phase === 'failed' && (
        <>
          {/* Keep progress visible so user sees how far we got + which step failed */}
          <RunningOverlay progress={progress} />
          <FailedCard
            failedStep={progress.steps.find(s => s.status === 'failed')}
            errorMessage={errorMessage}
            canRetry={!!matterId}
            onRetry={retry}
            onReset={() => location.reload()}
          />
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Drop zone — animated white/brand-blue marching dashes around a rounded
// rectangle, with a white-over-blue split fill inside. Uses SVG so the
// dashes follow the rounded corners without clipping.
// ──────────────────────────────────────────────────────────────────────────
function DropZone({ getRootProps, getInputProps, isDragActive, phase }) {
  const wrapRef = useRef(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  useEffect(() => {
    if (!wrapRef.current) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setSize({ w: Math.round(r.width), h: Math.round(r.height) })
    })
    ro.observe(wrapRef.current)
    return () => ro.disconnect()
  }, [])

  // Geometry — a 4px stroke inset 3px from the wrapper edge, on a 16px corner radius.
  const STROKE = 4
  const INSET  = 3
  const RADIUS = 14
  const DASH   = 14
  const isPaused = phase !== 'input'

  return (
    <div
      {...getRootProps()}
      ref={wrapRef}
      className={`relative cursor-pointer rounded-2xl mb-6 transition-transform duration-150 ${
        isPaused ? 'opacity-60 cursor-not-allowed' : 'hover:-translate-y-0.5'
      }`}
    >
      <input {...getInputProps()} />

      {/* Animated dashed border — SVG so corners aren't clipped */}
      {size.w > 0 && size.h > 0 && (
        <svg
          className="absolute inset-0 pointer-events-none"
          width={size.w}
          height={size.h}
          aria-hidden="true"
        >
          {/* Brand-blue dashes */}
          <rect
            x={INSET}
            y={INSET}
            width={size.w - INSET * 2}
            height={size.h - INSET * 2}
            rx={RADIUS}
            ry={RADIUS}
            strokeWidth={STROKE}
            strokeDasharray={`${DASH} ${DASH}`}
            className={`lc-dash-stroke lc-dash-blue ${isPaused ? 'is-paused' : ''}`}
          />
          {/* White dashes — same animation, half-cycle delayed → alternating color effect */}
          <rect
            x={INSET}
            y={INSET}
            width={size.w - INSET * 2}
            height={size.h - INSET * 2}
            rx={RADIUS}
            ry={RADIUS}
            strokeWidth={STROKE}
            strokeDasharray={`${DASH} ${DASH}`}
            className={`lc-dash-stroke lc-dash-white lc-dash-offset ${isPaused ? 'is-paused' : ''}`}
          />
        </svg>
      )}

      {/* Inner card: top half white, bottom half brand-blue tint */}
      <div
        className={`relative m-2 rounded-xl overflow-hidden text-center transition-shadow ${
          isDragActive ? 'shadow-modal' : 'shadow-card'
        }`}
        style={{
          background: 'linear-gradient(to bottom, #ffffff 0%, #ffffff 50%, var(--brand-100) 50%, var(--brand-50) 100%)',
        }}
      >
        <div className="px-8 py-12">
          <div className="mx-auto flex items-center justify-center w-20 h-20 rounded-2xl bg-white shadow-md ring-1 ring-brand-200/70 mb-5">
            <img src="/logo-icon.png" alt="" className="h-12 w-12" />
          </div>
          <p
            className="text-slate-900 font-semibold text-lg tracking-wide"
            style={{ fontVariant: 'all-small-caps' }}
          >
            {isDragActive ? 'Release to upload…' : 'Drop policies + lawsuit here'}
          </p>
          <p
            className="text-slate-600 text-sm mt-1 tracking-wide"
            style={{ fontVariant: 'all-small-caps' }}
          >
            or click anywhere in this box to browse
          </p>
          <div className="mt-6 inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-[11px] uppercase tracking-wider text-brand-800/80 font-medium">
            <span>CGL</span><span className="text-brand-400">·</span>
            <span>Pollution</span><span className="text-brand-400">·</span>
            <span>Professional</span><span className="text-brand-400">·</span>
            <span>Builder's Risk</span><span className="text-brand-400">·</span>
            <span>Umbrella</span><span className="text-brand-400">·</span>
            <span>Excess</span><span className="text-brand-400">·</span>
            <span>Complaint</span><span className="text-brand-400">·</span>
            <span>Pre-suit Demand</span><span className="text-brand-400">·</span>
            <span>ROR</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// File card — one row per uploaded file
// ──────────────────────────────────────────────────────────────────────────
function FileCard({ file, effectiveKind, effectiveForm, onSetKind, onSetForm, onRemove, onRetry, disabled }) {
  const f = file
  const c = f.classification
  const isTrigger = TRIGGER_KINDS.has(effectiveKind)

  return (
    <div className="card p-4 flex items-start gap-4">
      <FileText className="h-5 w-5 text-slate-400 mt-0.5 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-slate-900 truncate">{f.file.name}</span>
          <span className="text-xs text-slate-400">{Math.round(f.file.size / 1024)} KB</span>
        </div>

        {f.status === 'uploading'   && <Status icon="spin" text="Uploading…" />}
        {f.status === 'classifying' && <Status icon="spin" text="Classifying…" />}
        {f.status === 'error'       && (
          <div className="flex items-center gap-2 flex-wrap mt-1">
            <Status icon="x" text={f.error} />
            {onRetry && (
              <button
                onClick={onRetry}
                disabled={disabled}
                className="text-xs font-semibold text-brand-700 hover:text-brand-800 underline tracking-wide disabled:opacity-40"
                style={{ fontVariant: 'all-small-caps' }}
              >
                Retry
              </button>
            )}
          </div>
        )}

        {f.status === 'ready' && (
          <div className="flex items-center gap-2 flex-wrap mt-1">
            {/* Kind badge / dropdown */}
            <KindDropdown
              value={effectiveKind}
              onChange={onSetKind}
              disabled={disabled}
            />
            {effectiveKind === 'policy' && (
              <PolicyFormDropdown
                value={effectiveForm}
                onChange={onSetForm}
                disabled={disabled}
              />
            )}
            {c?.confidence && c.confidence !== 'high' && !f.kindOverride && (
              <span className="text-xs text-amber-700 inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {c.confidence} confidence — verify
              </span>
            )}
            {c?.summary && (
              <p className="text-xs text-slate-500 w-full mt-1.5 leading-relaxed">{c.summary}</p>
            )}
            {isTrigger && c?.venue_state && (
              <span className="text-xs text-slate-500">Venue: {c.venue_state}</span>
            )}
            {c?.carrier_or_caption && (
              <span className="text-xs text-slate-500 w-full italic">{c.carrier_or_caption}</span>
            )}
          </div>
        )}
      </div>

      <button
        onClick={onRemove}
        disabled={disabled}
        className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
        title="Remove"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

function Status({ icon, text }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-600">
      {icon === 'spin' ? <Loader2 className="h-3 w-3 animate-spin text-brand-500" /> : <XCircle className="h-3 w-3 text-rose-500" />}
      <span>{text}</span>
    </div>
  )
}

function KindDropdown({ value, onChange, disabled }) {
  const colorCls = KIND_COLORS[value] || KIND_COLORS.other
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className={`text-xs font-medium px-2 py-0.5 rounded-full border ${colorCls} focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:opacity-50`}
    >
      {Object.entries(KIND_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  )
}

function PolicyFormDropdown({ value, onChange, disabled }) {
  return (
    <select
      value={value || 'OTHER'}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      className="text-xs font-medium px-2 py-0.5 rounded-full border border-slate-200 bg-white text-slate-700 focus:ring-2 focus:ring-brand-300 focus:outline-none disabled:opacity-50"
    >
      {Object.entries(POLICY_FORM_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Multi-state comparison selector
// ──────────────────────────────────────────────────────────────────────────
function MultiStateSelector({ states, onChange, exclude, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    function onDoc(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const toggle = (s) => {
    if (states.includes(s)) onChange(states.filter(x => x !== s))
    else onChange([...states, s])
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(o => !o)}
        className="form-select w-full text-left flex items-center justify-between disabled:opacity-50"
      >
        <span className={states.length === 0 ? 'text-slate-400' : 'text-slate-900'}>
          {states.length === 0 ? 'None' : states.join(', ')}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-64 max-h-72 overflow-auto bg-white border border-slate-200 rounded-lg shadow-modal p-2">
          <div className="grid grid-cols-4 gap-1">
            {ALL_STATES.filter(s => s !== exclude).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => toggle(s)}
                className={`px-2 py-1 text-xs font-medium rounded ${
                  states.includes(s)
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Running overlay — driven by REAL pipeline events from Analyzer's `progress`
// state. Each step shows pending / active / done / failed based on what the
// pipeline has actually completed. The detail line ("3 of 4 parsed",
// "validating · attempt 2/3", etc.) updates live as events fire.
// ──────────────────────────────────────────────────────────────────────────
function RunningOverlay({ progress }) {
  const steps = progress?.steps || []
  const detail = progress?.detail || ''
  const activeStep = steps.find(s => s.status === 'active')

  return (
    <div className="rounded-2xl overflow-hidden border border-brand-200/60 shadow-card">
      {/* Hero strip with rotating logo */}
      <div
        className="relative px-6 py-8 text-white"
        style={{
          background:
            'linear-gradient(135deg, var(--brand-700) 0%, var(--brand-600) 45%, var(--brand-500) 100%)',
        }}
      >
        <div
          className="absolute inset-0 opacity-30 pointer-events-none"
          style={{
            background:
              'repeating-linear-gradient(45deg, transparent 0 14px, rgba(255,255,255,0.08) 14px 16px)',
          }}
          aria-hidden="true"
        />

        <div className="relative flex items-center gap-5">
          <div className="relative h-16 w-16 flex-shrink-0">
            <div
              className="absolute inset-0 rounded-2xl border-2 border-white/40 border-t-white"
              style={{ animation: 'spin 1.4s linear infinite' }}
            />
            <div className="absolute inset-1 rounded-xl bg-white/95 flex items-center justify-center shadow-md">
              <img src="/logo-icon.png" alt="" className="h-9 w-9" />
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-[0.22em] text-brand-100/90 font-semibold mb-1">
              LexClause is working
            </div>
            <h2 className="font-serif-brand text-3xl uppercase tracking-tight leading-none">
              <span className="lc-title-underline">Analyzing</span>
            </h2>
            <p
              className="text-brand-50/95 text-sm mt-3 tracking-wide truncate"
              style={{ fontVariant: 'all-small-caps' }}
            >
              {activeStep
                ? `${activeStep.label}${detail ? ' · ' + detail : ''}`
                : 'Initializing pipeline…'}
            </p>
          </div>
        </div>
      </div>

      {/* Progress steps — real status from the pipeline */}
      <div className="bg-white p-6">
        <ol className="space-y-2.5">
          {steps.map((s) => (
            <li key={s.id} className="flex items-center gap-3 text-sm">
              {s.status === 'done' && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-600 text-white flex-shrink-0">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </span>
              )}
              {s.status === 'active' && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-brand-100 text-brand-700 flex-shrink-0 ring-2 ring-brand-300/60">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                </span>
              )}
              {s.status === 'pending' && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-400 flex-shrink-0">
                  <span className="block w-2 h-2 rounded-full bg-slate-300" />
                </span>
              )}
              {s.status === 'failed' && (
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 flex-shrink-0 ring-2 ring-red-300/60">
                  <XCircle className="h-3.5 w-3.5" />
                </span>
              )}
              <span
                className={
                  s.status === 'done'    ? 'text-slate-500 line-through decoration-brand-300 decoration-2' :
                  s.status === 'active'  ? 'text-slate-900 font-medium' :
                  s.status === 'failed'  ? 'text-red-700 font-medium' :
                                           'text-slate-400'
                }
                style={s.status === 'active' ? { fontVariant: 'all-small-caps', letterSpacing: '0.04em' } : undefined}
              >
                {s.label}
              </span>
              {s.status === 'active' && detail && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-brand-700 font-semibold truncate max-w-[55%]">
                  <span className="block w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse flex-shrink-0" />
                  <span className="truncate">{detail}</span>
                </span>
              )}
              {s.status === 'failed' && (
                <span className="ml-auto inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-red-700 font-semibold">
                  failed
                </span>
              )}
            </li>
          ))}
        </ol>

        <div className="mt-6 pt-5 border-t border-brand-100 flex items-center gap-3 text-xs">
          <span className="font-serif-brand text-brand-700 tracking-wider">LexClause</span>
          <span className="text-slate-300">·</span>
          <span
            className="text-slate-500 tracking-wide"
            style={{ fontVariant: 'all-small-caps' }}
          >
            Citations drawn only from the curated catalog
          </span>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Result view — wraps the shared SingleStateResult / ComparisonResult so we
// can pass the live "New analysis" reset action.
// ──────────────────────────────────────────────────────────────────────────
function ResultView({ analysis, comparison, comparisonGroupId, onReset }) {
  const newAnalysisBtn = (
    <button onClick={onReset} className="btn-secondary">
      <Plus className="h-4 w-4" /> New analysis
    </button>
  )
  if (comparisonGroupId && comparison?.length) {
    return <ComparisonResult comparison={comparison} headerActions={newAnalysisBtn} />
  }
  if (!analysis) return <div className="p-10 text-center text-slate-500">Loading…</div>
  return <SingleStateResult analysis={analysis} headerActions={newAnalysisBtn} />
}

// ──────────────────────────────────────────────────────────────────────────
// FailedCard — sits below the running overlay when a step blew up.
// Shows which step failed, the actual error message, and the recovery
// options: Retry (re-runs from a sensible resume point) and Start over (full
// page reload).
// ──────────────────────────────────────────────────────────────────────────
function FailedCard({ failedStep, errorMessage, canRetry, onRetry, onReset }) {
  return (
    <div className="card p-5 mt-4 border-red-200 bg-red-50/40 text-red-900">
      <div className="flex items-start gap-3">
        <XCircle className="h-5 w-5 mt-0.5 flex-shrink-0 text-red-600" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-base">
            {failedStep?.label ? `Step failed: ${failedStep.label}.` : 'Analysis failed.'}
          </p>
          {errorMessage && (
            <pre className="text-xs mt-2 whitespace-pre-wrap font-mono bg-red-100/60 p-2.5 rounded border border-red-200/70 max-h-32 overflow-y-auto">
              {errorMessage}
            </pre>
          )}
          <div className="flex items-center gap-3 mt-4">
            {canRetry && (
              <button
                onClick={onRetry}
                className="btn-primary"
                style={{ fontVariant: 'all-small-caps' }}
              >
                <Loader2 className="h-4 w-4" /> Retry
              </button>
            )}
            <button
              onClick={onReset}
              className="text-sm text-red-800 hover:text-red-900 underline font-medium"
            >
              Start over
            </button>
          </div>
          {canRetry && (
            <p className="text-xs text-red-700/80 mt-3 italic">
              Retry re-runs the priority engine on the same matter and policies. Documents are not re-uploaded.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
