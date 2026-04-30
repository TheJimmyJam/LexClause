import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Scale } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import toast from 'react-hot-toast'

export default function Register() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const navigate = useNavigate()

  const onSubmit = async ({ email, password, firstName, lastName, orgName }) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name:  lastName,
          org_name:   orgName,
          source_app: 'lexclause',
        }
      }
    })
    if (error) { toast.error(error.message); return }

    // The lc_organizations + lc_profiles rows are created server-side by the
    // handle_new_lexclause_user() trigger on auth.users (see migration 001).
    toast.success('Account created. Check your email to confirm.')
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <div className="w-[72px] h-[72px] rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-2xl shadow-brand-600/40">
              <Scale className="h-9 w-9 text-white" />
            </div>
          </div>
          <h1 className="text-2xl font-bold text-white">Create your LexClause account</h1>
          <p className="text-slate-400 mt-1 text-sm">Coverage analysis for multi-policy, multi-state matters.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl p-8 shadow-2xl space-y-4">
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
            <input className="form-input" placeholder="Smith &amp; Wesson LLP"
              {...register('orgName', { required: 'Organization is required' })} />
            {errors.orgName && <p className="text-red-500 text-xs mt-1">{errors.orgName.message}</p>}
          </div>

          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" placeholder="you@firm.com"
              {...register('email', { required: 'Email is required' })} />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label className="form-label">Password</label>
            <input type="password" className="form-input" placeholder="At least 8 characters"
              {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })} />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center">
            {isSubmitting ? 'Creating account…' : 'Create Account'}
          </button>

          <p className="text-center text-sm text-slate-600">
            Already have an account? <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
