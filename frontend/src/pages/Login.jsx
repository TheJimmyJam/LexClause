import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Eye, EyeOff } from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import toast from 'react-hot-toast'

export default function Login() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm()
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  const onSubmit = async ({ email, password }) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { toast.error(error.message); return }
    navigate('/analyze')
  }

  return (
    <AuthShell
      title="Sign In"
      subtitle="Coverage priority opinions, made defensible."
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div>
          <label className="form-label">Email</label>
          <input
            type="email" placeholder="you@firm.com"
            className="form-input"
            {...register('email', { required: 'Email is required' })}
          />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>

        <div>
          <label className="form-label">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="form-input pr-10"
              {...register('password', { required: 'Password is required' })}
            />
            <button type="button" className="absolute right-3 top-2.5 text-slate-400 hover:text-brand-600"
              onClick={() => setShowPassword(p => !p)}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>

        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-brand-700 hover:text-brand-800 text-xs font-medium">
            Forgot password?
          </Link>
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="btn-primary w-full justify-center tracking-wide"
          style={{ fontVariant: 'all-small-caps' }}
        >
          {isSubmitting ? 'Signing in…' : 'Sign In'}
        </button>

        <p className="text-center text-sm text-slate-600">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-700 hover:text-brand-800 font-semibold">
            Sign up
          </Link>
        </p>
      </form>
    </AuthShell>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// Shared auth shell — logo lockup, serif title with brand underline, footer
// ──────────────────────────────────────────────────────────────────────────
export function AuthShell({ title, subtitle, children, wide = false }) {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 py-10"
      style={{
        background:
          'radial-gradient(circle at top, rgba(37,99,235,0.18) 0%, transparent 60%), linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #0f172a 100%)',
      }}
    >
      <div className={`w-full ${wide ? 'max-w-lg' : 'max-w-md'}`}>
        {/* Brand lockup */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-5">
            <img
              src="/logo-icon.png"
              alt="LexClause"
              className="w-[72px] h-[72px] rounded-2xl ring-1 ring-white/15 shadow-2xl shadow-brand-700/50 bg-white p-1.5"
            />
          </div>
          <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-300 mb-1">
            LexClause
          </div>
          <h1 className="font-serif-brand text-4xl tracking-tight text-white leading-none">
            <span className="lc-title-underline uppercase">{title}</span>
          </h1>
          {subtitle && (
            <p
              className="text-slate-300 mt-6 text-sm tracking-wide"
              style={{ fontVariant: 'all-small-caps' }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Card with brand accent stripe */}
        <div className="rounded-2xl shadow-2xl shadow-brand-900/40 overflow-hidden bg-white">
          <div
            className="h-1.5"
            style={{ background: 'linear-gradient(90deg, var(--brand-700), var(--brand-500), var(--brand-300))' }}
            aria-hidden="true"
          />
          <div className="p-8">{children}</div>
        </div>

        {/* Footer brand mark */}
        <div className="text-center text-xs text-slate-400 mt-6 tracking-wide">
          <span className="font-serif-brand text-brand-300">LexClause</span>
          <span className="mx-2 text-slate-600">·</span>
          <span style={{ fontVariant: 'all-small-caps' }}>
            Citations drawn only from the curated catalog
          </span>
        </div>
      </div>
    </div>
  )
}
