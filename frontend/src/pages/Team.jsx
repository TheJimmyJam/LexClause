/**
 * Team — list members of the current org and let admins invite new members.
 *
 * Permissions:
 *   - All members can see who's on the team and pending invitations.
 *   - Only admins can invite, change roles, remove members, or revoke invites.
 *
 * The invite flow:
 *   1. Admin enters email + role.
 *   2. Frontend calls the team-invite edge function (which inserts the row
 *      and sends the email via Resend).
 *   3. Invitee clicks the email link → /register?invite=<token>&email=<...>
 *      → signs up. The handle_new_lexclause_user() trigger consumes the token
 *      and joins them to the inviting org with the invited role.
 */

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Mail, UserPlus, Shield, Trash2, Loader2, Copy, RefreshCw, Sparkles, X } from 'lucide-react'
import toast from 'react-hot-toast'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../hooks/useAuth.jsx'

const APP_URL = (typeof window !== 'undefined' && window.location.origin) || 'https://lexclause.netlify.app'

export default function Team() {
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const orgId   = profile?.org_id
  const myId    = profile?.id

  const qc = useQueryClient()

  const { data: members = [], isLoading: mLoading } = useQuery({
    queryKey: ['lc_team_members', orgId],
    enabled:  !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_profiles')
        .select('id, email, first_name, last_name, role, created_at')
        .eq('org_id', orgId)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })

  const { data: invites = [], isLoading: iLoading, refetch: refetchInvites } = useQuery({
    queryKey: ['lc_team_invites', orgId],
    enabled:  !!orgId && isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lc_invitations')
        .select('id, email, role, token, created_at, expires_at, accepted_at, revoked_at, invited_by')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })

  // ── Invite form ─────────────────────────────────────────────────────────
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole,  setInviteRole]  = useState('member')
  const [inviting,    setInviting]    = useState(false)

  const sendInvite = async (e) => {
    e.preventDefault()
    if (!inviteEmail.trim()) return
    setInviting(true)
    try {
      const { data, error } = await supabase.functions.invoke('team-invite', {
        body: {
          email:   inviteEmail.trim().toLowerCase(),
          role:    inviteRole,
          app_url: APP_URL,
        },
      })
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      if (data?.email_sent) {
        toast.success(`Invitation sent to ${inviteEmail.trim()}`)
      } else if (data?.send_error) {
        toast.error(`Invitation created but email failed: ${data.send_error.slice(0, 200)}`)
      } else {
        toast.success(`Invitation created for ${inviteEmail.trim()}`)
      }
      setInviteEmail('')
      setInviteRole('member')
      refetchInvites()
    } catch (e) {
      toast.error(e?.message || 'Could not send invitation')
    } finally {
      setInviting(false)
    }
  }

  const revokeInvite = async (invId) => {
    if (!confirm('Revoke this invitation? The link will stop working.')) return
    const { error } = await supabase.from('lc_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('id', invId)
    if (error) { toast.error(error.message); return }
    toast.success('Invitation revoked.')
    refetchInvites()
  }

  const copyLink = (token, email) => {
    const link = `${APP_URL}/register?invite=${token}&email=${encodeURIComponent(email)}`
    navigator.clipboard.writeText(link)
      .then(() => toast.success('Invitation link copied'))
      .catch(() => toast.error('Could not copy link'))
  }

  const changeRole = async (memberId, newRole) => {
    const { error } = await supabase.from('lc_profiles')
      .update({ role: newRole })
      .eq('id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success('Role updated.')
    qc.invalidateQueries({ queryKey: ['lc_team_members', orgId] })
  }

  const removeMember = async (memberId, label) => {
    if (memberId === myId) {
      toast.error("You can't remove yourself.")
      return
    }
    if (!confirm(`Remove ${label} from this organization? They'll lose access immediately.`)) return
    const { error } = await supabase.from('lc_profiles')
      .delete()
      .eq('id', memberId)
    if (error) { toast.error(error.message); return }
    toast.success('Member removed.')
    qc.invalidateQueries({ queryKey: ['lc_team_members', orgId] })
  }

  const pendingInvites  = invites.filter(i => !i.accepted_at && !i.revoked_at && new Date(i.expires_at) > new Date())
  const acceptedInvites = invites.filter(i =>  i.accepted_at)
  const expiredOrRevoked= invites.filter(i => !i.accepted_at && (i.revoked_at || new Date(i.expires_at) <= new Date()))

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto">
      {/* Header */}
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4 mb-5">
          <div className="flex items-center gap-4">
            <img src="/logo-icon.png" alt="LexClause" className="h-12 w-12 rounded-xl ring-1 ring-brand-200/70 shadow-sm bg-white p-1" />
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700">LexClause</span>
              <span className="text-xs text-slate-500 tracking-wide">Team management</span>
            </div>
          </div>
          <Link to="/analyze" className="btn-primary"><Sparkles className="h-4 w-4" /> New analysis</Link>
        </div>

        <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight text-slate-900 leading-none">
          <span className="lc-title-underline uppercase">Team</span>
        </h1>
        <p className="text-slate-600 mt-6 text-base tracking-wide" style={{ fontVariant: 'all-small-caps' }}>
          {profile?.organization?.name || 'Your organization'} · {members.length} member{members.length === 1 ? '' : 's'}
          {isAdmin && pendingInvites.length > 0 && <> · {pendingInvites.length} pending invitation{pendingInvites.length === 1 ? '' : 's'}</>}
        </p>
      </header>

      {/* Invite form (admin only) */}
      {isAdmin && (
        <div className="card p-5 mb-6 bg-gradient-to-br from-brand-50/40 to-cyan-50/30 border-brand-200/60">
          <h2 className="font-semibold text-slate-900 mb-3 flex items-center gap-2 text-sm">
            <UserPlus className="h-4 w-4 text-brand-600" />
            Invite a member
          </h2>
          <form onSubmit={sendInvite} className="grid sm:grid-cols-[1fr_140px_auto] gap-2 items-start">
            <input
              type="email" required
              placeholder="email@firm.com"
              className="form-input text-sm"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
            />
            <select
              className="form-input text-sm"
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value)}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
            <button
              type="submit" disabled={inviting || !inviteEmail.trim()}
              className="btn-primary"
              style={{ fontVariant: 'all-small-caps' }}
            >
              {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              {inviting ? 'Sending…' : 'Send invite'}
            </button>
          </form>
          <p className="text-[11px] text-slate-500 mt-2 leading-snug">
            Invitee gets an email with a one-time signup link. Admins can manage everyone (invite, change roles, remove). Members can do everything else with the data.
          </p>
        </div>
      )}

      {/* Members list */}
      <div className="card overflow-hidden mb-6">
        <div className="px-5 py-3 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Members</h2>
        </div>
        {mLoading ? (
          <div className="p-8 text-center text-slate-500 text-sm">Loading…</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {members.map(m => (
              <li key={m.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-slate-900 truncate">
                    {(m.first_name || m.last_name) ? `${m.first_name || ''} ${m.last_name || ''}`.trim() : m.email}
                    {m.id === myId && <span className="text-xs text-slate-400 font-normal ml-2">(you)</span>}
                  </div>
                  <div className="text-xs text-slate-500 truncate">{m.email}</div>
                </div>
                <RoleBadge role={m.role} />
                {isAdmin && m.id !== myId && (
                  <div className="flex items-center gap-1.5">
                    <select
                      className="text-xs px-2 py-1 rounded border border-slate-200 bg-white"
                      value={m.role}
                      onChange={e => changeRole(m.id, e.target.value)}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      onClick={() => removeMember(m.id, m.email)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded"
                      title="Remove from organization"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Pending invitations (admin only) */}
      {isAdmin && (
        <div className="card overflow-hidden mb-6">
          <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900 text-sm">Pending invitations</h2>
            <button onClick={() => refetchInvites()} className="text-slate-400 hover:text-brand-700" title="Refresh">
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          {iLoading ? (
            <div className="p-6 text-center text-slate-500 text-sm">Loading…</div>
          ) : pendingInvites.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm italic">No pending invitations.</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pendingInvites.map(i => (
                <li key={i.id} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-slate-900 truncate">{i.email}</div>
                    <div className="text-xs text-slate-500">
                      Invited as {i.role} · expires {new Date(i.expires_at).toLocaleDateString()}
                    </div>
                  </div>
                  <button onClick={() => copyLink(i.token, i.email)}  className="text-xs text-brand-700 hover:text-brand-800 inline-flex items-center gap-1 font-medium">
                    <Copy className="h-3 w-3" /> Copy link
                  </button>
                  <button onClick={() => revokeInvite(i.id)}  className="text-slate-400 hover:text-rose-600 p-1 rounded" title="Revoke invitation">
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {(acceptedInvites.length > 0 || expiredOrRevoked.length > 0) && (
            <details className="border-t border-slate-100">
              <summary className="px-5 py-2.5 text-xs text-slate-500 cursor-pointer hover:text-slate-700 select-none">
                History · {acceptedInvites.length} accepted · {expiredOrRevoked.length} expired/revoked
              </summary>
              <ul className="divide-y divide-slate-100 bg-slate-50/40">
                {[...acceptedInvites, ...expiredOrRevoked].map(i => (
                  <li key={i.id} className="px-5 py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1 text-slate-600 truncate">
                      {i.email} <span className="text-slate-400">· {i.role}</span>
                    </div>
                    <span className={i.accepted_at ? 'text-emerald-700' : 'text-slate-400'}>
                      {i.accepted_at ? `accepted ${new Date(i.accepted_at).toLocaleDateString()}` :
                        i.revoked_at ? `revoked ${new Date(i.revoked_at).toLocaleDateString()}` :
                        `expired ${new Date(i.expires_at).toLocaleDateString()}`}
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {!isAdmin && (
        <p className="text-xs text-slate-500 italic text-center px-4 mb-6">
          Only organization admins can invite or remove members. Ask an admin to send a new invite.
        </p>
      )}
    </div>
  )
}

function RoleBadge({ role }) {
  if (role === 'admin') {
    return (
      <span className="badge bg-brand-100 text-brand-800 border border-brand-200 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold">
        <Shield className="h-3 w-3" /> Admin
      </span>
    )
  }
  return (
    <span className="badge bg-slate-100 text-slate-700 border border-slate-200 text-[10px] uppercase tracking-wider font-semibold">
      Member
    </span>
  )
}
