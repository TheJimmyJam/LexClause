import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Loader2, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import { extractPolicyTerms } from '../lib/policyAnalysis.js'
import toast from 'react-hot-toast'

export default function PolicyUpload() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState([])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'application/pdf': ['.pdf'] },
    multiple: true,
    onDrop: async (files) => {
      if (!profile?.org_id) { toast.error('No organization on profile.'); return }
      setUploading(true)
      try {
        for (const file of files) {
          // 1. Upload PDF to storage
          const filePath = `${profile.org_id}/${Date.now()}-${file.name}`
          const { error: uploadErr } = await supabase.storage
            .from('lc-policies')
            .upload(filePath, file, { contentType: 'application/pdf' })
          if (uploadErr) throw uploadErr

          // 2. Create lc_policies row
          const { data: policy, error: insertErr } = await supabase
            .from('lc_policies')
            .insert({
              org_id: profile.org_id,
              source_filename: file.name,
              source_storage_path: filePath,
              extraction_status: 'extracting',
            })
            .select()
            .single()
          if (insertErr) throw insertErr

          // 3. Trigger Claude extraction (Edge Function)
          extractPolicyTerms(policy.id).catch(e => {
            console.error('Extraction kickoff failed', e)
            toast.error(`Extraction failed for ${file.name} — you can retry from the policy page.`)
          })

          setUploaded(prev => [...prev, { id: policy.id, name: file.name }])
        }
        toast.success(`Queued ${files.length} polic${files.length === 1 ? 'y' : 'ies'} for extraction.`)
      } catch (e) {
        console.error(e)
        toast.error(e.message || 'Upload failed.')
      } finally {
        setUploading(false)
      }
    }
  })

  return (
    <div className="p-6 lg:p-10 max-w-3xl mx-auto">
      <Link to="/policies" className="text-sm text-slate-500 hover:text-slate-700 inline-flex items-center gap-1 mb-4">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to policies
      </Link>

      <h1 className="text-3xl font-bold text-slate-900 mb-2">Upload Policy PDFs</h1>
      <p className="text-slate-600 mb-8">Claude extracts limits, retentions, other-insurance language, and endorsements. Multi-file upload supported.</p>

      <div
        {...getRootProps()}
        className={`card p-12 text-center cursor-pointer border-2 border-dashed transition-colors ${
          isDragActive ? 'border-brand-500 bg-brand-50/50' : 'border-slate-300 hover:border-brand-400 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-10 w-10 text-slate-400 mx-auto mb-4" />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-brand-700">
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </div>
        ) : (
          <>
            <p className="font-medium text-slate-900">Drop PDFs here or click to choose</p>
            <p className="text-sm text-slate-500 mt-1">CGL, umbrella, excess, D&amp;O — anything with coverage language.</p>
          </>
        )}
      </div>

      {uploaded.length > 0 && (
        <div className="card mt-6">
          <div className="px-4 py-3 border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-semibold">
            Just uploaded
          </div>
          <ul className="divide-y divide-slate-100">
            {uploaded.map(u => (
              <li key={u.id} className="px-4 py-3 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm text-slate-700">
                  <FileText className="h-4 w-4 text-slate-400" /> {u.name}
                </span>
                <Link to={`/policies/${u.id}`} className="text-brand-700 hover:text-brand-800 text-xs font-medium">
                  View →
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
