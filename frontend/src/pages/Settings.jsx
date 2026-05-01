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

import { useEffect, useMemo } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { User, Building2, Users, Sparkles } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.jsx'
import TeamPanel from '../components/TeamPanel.jsx'

export default function Settings() {
  const { profile, user } = useAuth()
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
        <OrgPanel profile={profile} />
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

function OrgPanel({ profile }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Organization</h2>
      <div className="grid sm:grid-cols-2 gap-4 text-sm">
        <Field label="Organization" value={profile?.organization?.name} />
        <Field label="Organization ID" value={profile?.org_id} mono />
        <Field label="Your role" value={profile?.role} />
      </div>
      <p className="text-xs text-slate-400 mt-6 italic">
        Coverage matters, policies, and analyses are scoped to this organization. Anyone added through the{' '}
        <em>Team</em> tab can see everything in this org.
      </p>
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
