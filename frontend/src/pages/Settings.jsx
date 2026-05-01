/**
 * Settings — tabbed page covering:
 *   - Profile         (my account)
 *   - Organization    (org name, id)
 *   - Team            (members + invite flow; admins-only controls)
 *
 * Tab is reflected in the URL via ?tab=team so users can deep-link / share.
 * For org admins the Team tab is the default landing tab; for members the
 * Profile tab is the default.
 */

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams, Link, useNavigate } from 'react-router-dom'
import { User, Building2, Users, Sparkles, Plus, X, Loader2, Shield, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'
import TeamPanel from '../components/TeamPanel.jsx'

const APP_URL = (typeof window !== 'undefined' && window.location.origin) || 'https://lexclause.netlify.app'

export default function Settings() {
  const { profile, user, isSuperAdmin } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [params, setParams] = useSearchParams()

  const tabs = useMemo(() => ([
    { id: 'profile',      label: 'Profile',      icon: User },
    { id: 'organization', label: 'Organization', icon: Building2 },
    { id: 'team',         label: 'Team',         icon: Users },
  ]), [])

  // Default tab: admins land on Team (since that's what they're usually here for);
  // members land on Profile.
  const defaultTab = isAdmin ? 'team' : 'profile'
  const tab = (() => {
    const t = params.get('tab')
    return tabs.some(x => x.id === t) ? t : defaultTab
  })()

  // Normalize URL once on mount if tab param is missing/invalid
  useEffect(() => {
    if (params.get('tab') !== tab) {
      const next = new URLSearchParams(params)
      next.set('tab', tab)
      setParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setTab = (id) => {
    const next = new URLSearchParams(params)
    next.set('tab', id)
    setParams(next)
  }

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <img src="/logo-icon.png" alt="LexClause" className="h-12 w-12 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">LexClause</span>
              <span className="text-xs text-slate-500 tracking-wide">Account &amp; team</span>
            </div>
          </div>
          <Link to="/analyze" className="btn-secondary"><Sparkles className="h-4 w-4" /> New analysis</Link>
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Settings</span>
        </h1>
      </header>

      {/* Tab bar */}
      <div className="border-b border-slate-200 mb-6 -mt-2">
        <div className="flex items-center gap-1 flex-wrap">
          {tabs.map(t => {
            const Icon = t.icon
            const active = tab === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`relative px-4 py-2.5 text-sm font-medium tracking-wide inline-flex items-center gap-2 transition-colors ${
                  active
                    ? 'text-brand-700'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
                style={{ fontVariant: 'all-small-caps' }}
              >
                <Icon className="h-4 w-4" />
                {t.label}
                {active && (
                  <span
                    aria-hidden="true"
                    className="absolute left-2 right-2 -bottom-px h-0.5 rounded-full"
                    style={{ background: 'linear-gradient(90deg, var(--brand-700), var(--brand-400))' }}
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Panels */}
      {tab === 'profile' && (
        <ProfilePanel user={user} profile={profile} />
      )}
      {tab === 'organization' && (
        <OrgPanel profile={profile} isSuperAdmin={isSuperAdmin} />
      )}
      {tab === 'team' && (
        <TeamPanel />
      )}
    </div>
  )
}

function ProfilePanel({ user, profile }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Profile</h2>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <Field label="Email"      value={user?.email} />
        <Field label="Role"       value={profile?.role} />
        <Field label="First name" value={profile?.first_name} />
        <Field label="Last name"  value={profile?.last_name} />
      </div>
      <p className="text-xs text-slate-400 mt-6 italic">
        Password changes go through the email-reset flow.{' '}
        <Link to="/forgot-password" className="text-brand-700 hover:text-brand-800 underline">Request a reset link</Link>.
      </p>
    </div>
  )
}

function OrgPanel({ profile, isSuperAdmin }) {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="card p-6">
        <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Your organization</h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <Field label="Organization"     value={profile?.organization?.name} />
          <Field label="Organization ID"  value={profile?.org_id} mono />
          <Field label="Your role"        value={profile?.role} />
        </div>
        <p className="text-xs text-slate-400 mt-6 italic">
          Coverage matters, policies, and analyses are scoped to this organization. Anyone added through the{' '}
          <em>Team</em> tab can see everything in this org.
        </p>
      </div>

      {/* Super-admin only — provision a new customer organization */}
      {isSuperAdmin && (
        <div className="card p-6 mt-5 border-amber-200 bg-amber-50/40">
          <div className="flex items-start justify-between gap-3 mb-3">
            <div>
              <h2 className="font-semibold text-amber-900 mb-1 text-sm uppercase tracking-wider flex items-center gap-2">
                <Shield className="h-4 w-4" /> God-mode · provision new org
              </h2>
              <p className="text-xs text-amber-800/90 leading-relaxed">
                Create a brand-new customer organization (a separate firm) and invite their first admin.
                The new org's data is fully isolated from yours by RLS — you'll only see it via{' '}
                <Link to="/admin" className="underline font-medium">/admin</Link>.
              </p>
            </div>
            <button
              onClick={() => setCreateOpen(true)}
              className="btn-primary flex-shrink-0"
              style={{ fontVariant: 'all-small-caps' }}
            >
              <Plus className="h-4 w-4" /> New organization
            </button>
          </div>
        </div>
      )}

      {createOpen && <NewOrgModal onClose={() => setCreateOpen(false)} />}
    </>
  )
}

// ──────────────────────────────────────────────────────────────────────────
// NewOrgModal — super admins provision a fresh customer org and invite the
// first admin in one step. Inserts lc_organizations row (RLS allows it for
// super admins via the additive "lc_super_admin all" policy from migration
// 018), then fires team-invite with target_org_id.
// ──────────────────────────────────────────────────────────────────────────
function NewOrgModal({ onClose }) {
  const navigate = useNavigate()
  const [name,  setName]  = useState('')
  const [email, setEmail] = useState('')
  const [busy,  setBusy]  = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    try {
      // 1. Create the new org (super admin RLS allows the insert)
      const { data: org, error: orgErr } = await supabase
        .from('lc_organizations')
        .insert({ name: name.trim() })
        .select()
        .single()
      if (orgErr || !org) throw new Error(orgErr?.message || 'Could not create organization')

      // 2. Optionally invite the first admin if an email was provided.
      //    Empty email → org sits empty until invited later from /admin.
      let inviteResult = null
      if (email.trim()) {
        const { data: inv, error: invErr } = await supabase.functions.invoke('team-invite', {
          body: {
            email:         email.trim().toLowerCase(),
            role:          'admin',
            app_url:       APP_URL,
            target_org_id: org.id,
          },
        })
        if (invErr) throw invErr
        if (inv?.error) throw new Error(inv.error)
        inviteResult = inv
      }

      if (!inviteResult) {
        toast.success(`Created ${org.name} (empty — invite an admin from /admin when ready)`)
      } else if (inviteResult.email_sent) {
        toast.success(`Created ${org.name} and emailed admin invite to ${email.trim()}`)
      } else {
        toast.success(`Created ${org.name} (invite created — email status: ${inviteResult.send_error?.slice(0, 100) || 'unknown'})`)
      }
      onClose()
      navigate('/admin')
    } catch (e) {
      toast.error(e?.message || 'Could not create organization')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl shadow-brand-900/40 overflow-hidden bg-white"
        onClick={e => e.stopPropagation()}
      >
        <div
          className="h-1.5"
          style={{ background: 'linear-gradient(90deg, var(--brand-700), var(--brand-500), var(--brand-300))' }}
          aria-hidden="true"
        />
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-3 mb-1">
            <div>
              <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-amber-700 mb-1 inline-flex items-center gap-1.5">
                <Shield className="h-3 w-3" />
                God-mode
              </div>
              <h2 className="font-serif-brand text-2xl uppercase tracking-tight text-slate-900 leading-none">
                New organization
              </h2>
            </div>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 -mr-1 -mt-1">
              <X className="h-5 w-5" />
            </button>
          </div>

          <p className="text-xs text-slate-500 mt-3 mb-5 leading-relaxed">
            Provisions a brand-new customer organization and emails the first admin a signup link.
            The new org's data is fully isolated by RLS — you can manage it from{' '}
            <span className="text-brand-700 font-semibold">/admin</span>.
          </p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="form-label">Organization name</label>
              <input
                type="text" required autoFocus
                placeholder="e.g. Smith &amp; Wesson LLP"
                className="form-input"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">
                First admin email <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="email"
                placeholder="admin@firm.com"
                className="form-input"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                {email.trim()
                  ? <>They'll receive an invite email and become the org's first admin when they accept.</>
                  : <>Leave blank to create an empty org. You can invite an admin later from{' '}
                      <span className="text-brand-700 font-medium">/admin</span>.</>}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button
                type="submit"
                disabled={busy || !name.trim()}
                className="btn-primary"
                style={{ fontVariant: 'all-small-caps' }}
              >
                {busy
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : (email.trim() ? <Mail className="h-4 w-4" /> : <Plus className="h-4 w-4" />)}
                {busy
                  ? 'Creating…'
                  : (email.trim() ? 'Create & invite admin' : 'Create empty org')}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

function Field({ label, value, mono }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-500 font-semibold mb-1">{label}</div>
      <div className={`text-slate-900 ${mono ? 'font-mono text-xs' : ''}`}>
        {value || <span className="text-slate-400">—</span>}
      </div>
    </div>
  )
}
