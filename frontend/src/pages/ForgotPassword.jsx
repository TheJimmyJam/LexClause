import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase.js'
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-brand-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo-icon.png" alt="LexClause" className="w-[72px] h-[72px] rounded-2xl ring-1 ring-white/10 shadow-2xl shadow-brand-700/40" />
          </div>
          <h1 className="text-2xl font-bold text-white font-serif-brand">Reset your password</h1>
          <p className="text-slate-400 mt-1 text-sm">Enter your email and we'll send you a reset link.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl p-8 shadow-2xl space-y-5">
          <div>
            <label className="form-label">Email</label>
            <input type="email" className="form-input" {...register('email', { required: true })} />
          </div>
          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center">
            {isSubmitting ? 'Sending…' : 'Send reset link'}
          </button>
          <p className="text-center text-sm text-slate-600">
            <Link to="/login" className="text-brand-600 hover:text-brand-700 font-medium">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  )
}
