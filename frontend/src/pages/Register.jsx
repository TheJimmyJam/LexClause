import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Shield } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { AuthShell } from './Login.jsx'
import toast from 'react-hot-toast'

const DISCLAIMER_VERSION = 'v1'

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting }, watch } = useForm()
  const navigate = useNavigate()
  const acknowledged = watch('disclaimer')

  const onSubmit = async ({ email, password, firstName, lastName, orgName, disclaimer }) => {
    if (!disclaimer) {
      toast.error('You must acknowledge the disclaimer to create an account.')
      return
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name:               firstName,
          last_name:                lastName,
          org_name:                 orgName,
          source_app:               'lexclause',
          disclaimer_acknowledged:  true,
          disclaimer_version:       DISCLAIMER_VERSION,
        }
      }
    })
    if (error) { toast.error(error.message); return }

    // The lc_organizations + lc_profiles rows are created server-side by the
    // handle_new_lexclause_user() trigger on auth.users. Migration 015 extends
    // the trigger to capture the disclaimer acknowledgment passed in metadata.
    toast.success('Account created. Check your email to confirm.')
    navigate('/login')
  }

  return (
    <AuthShell
      title="Create Account"
      subtitle="Trigger · priority · exhaustion — for every matter."
      wide
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="form-label">First name</label>
            <input className="form-input" {...register('firstName', { required: true })} />
          </div>
          <div>
            <label className="form-label">Last name</label>
            <input className="form-input" {...register('lastName', { required: true })} />
          </div>
        </div>

        <div>
          <label className="form-label">Organization</label>
          <input
            className="form-input" placeholder="Smith &amp; Wesson LLP"
            {...register('orgName', { required: 'Organization is required' })}
          />
          {errors.orgName && <p className="text-red-500 text-xs mt-1">{errors.orgName.message}</p>}
        </div>

        <div>
          <label className="form-label">Email</label>
          <input
            type="email" className="form-input" placeholder="you@firm.com"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="form-label">Password</label>
          <input
            type="password" className="form-input" placeholder="At least 8 characters"
            {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
          />
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        {/* ── Disclaimer acknowledgment (required) ─────────────────────── */}
        <div className="rounded-lg border border-brand-200 bg-brand-50/60 p-4 mt-2">
          <div className="flex items-start gap-3">
            <Shield className="h-4 w-4 mt-0.5 text-brand-700 flex-shrink-0" />
            <div className="flex-1">
              <div
                className="text-[10px] font-semibold tracking-[0.18em] uppercase text-brand-700 mb-1"
              >
                Acknowledgment
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="h-4 w-4 mt-0.5 rounded border-brand-400 text-brand-600 focus:ring-brand-500 focus:ring-offset-0 flex-shrink-0"
                  {...register('disclaimer', { required: true })}
                />
                <span className="text-xs text-slate-700 leading-relaxed">
                  I understand that <strong>LexClause is a software service, not a law firm or lawyer</strong>.
                  Coverage opinions it generates are draft work product to assist coverage counsel —
                  they are <strong>not legal advice</strong> and do not substitute for independent professional
                  judgment. I will independently verify all citations, conclusions, and policy
                  interpretations before relying on them.
                </span>
              </label>
              {errors.disclaimer && (
                <p className="text-red-600 text-xs mt-2 ml-6">You must acknowledge to create an account.</p>
              )}
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSubmitting || !acknowledged}
          className="btn-primary w-full justify-center tracking-wide mt-2"
          style={{ fontVariant: 'all-small-caps' }}
        >
          {isSubmitting ? 'Creating account…' : 'Create Account'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-700 hover:text-brand-800 font-semibold">
            Sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
