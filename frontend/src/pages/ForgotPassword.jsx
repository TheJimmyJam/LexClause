import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase.js'
import { AuthShell } from './Login.jsx'
import toast from 'react-hot-toast'

export default function ForgotPassword() {
  const { register, handleSubmit, formState: { isSubmitting } } = useForm()

  const onSubmit = async ({ email }) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) { toast.error(error.message); return }
    toast.success('If an account exists for that email, a reset link is on its way.')
  }

  return (
    <AuthShell
      title="Reset Password"
      subtitle="Enter your email and we'll send you a reset link."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="form-label">Email</label>
          <input
            type="email" className="form-input" placeholder="you@firm.com"
            {...register('email', { required: true })}
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center tracking-wide"
          style={{ fontVariant: 'all-small-caps' }}
        >
          {isSubmitting ? 'Sending…' : 'Send reset link'}
        </button>

        <p className="text-center text-sm text-slate-600">
          <Link to="/login" className="text-brand-700 hover:text-brand-800 font-semibold">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}
