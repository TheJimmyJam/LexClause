import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase.js'
import { AuthShell } from './Login.jsx'
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

        <button
          type="submit"
          disabled={isSubmitting}
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
