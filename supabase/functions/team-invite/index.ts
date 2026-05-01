// supabase/functions/team-invite/index.ts
//
// Sends a team invitation. The caller (must be authenticated) inserts a row
// into lc_invitations via RLS (which permits only org admins), then this
// function emails the invitee a signup link via Resend.
//
// Why an edge function instead of doing it client-side?
//   - We need to send an email, which requires the RESEND_API_KEY held server-side.
//   - We can also validate that the caller is an admin and gracefully handle
//     the "user already exists" case (in which case we'd want to instead just
//     swap their org or invite them to log in — for v1 we just send the link).
//
// Required Edge Function secrets (already set for email-opinion):
//   RESEND_API_KEY
//   RESEND_FROM_EMAIL  (defaults to "LexClause <onboarding@resend.dev>")
//
// Request body:
//   {
//     email: string,           // invitee email
//     role:  'admin'|'member',
//     app_url: string,         // base URL to embed in the invite link (e.g. https://lexclause.netlify.app)
//   }
//
// Response:
//   { ok: true, invitation_id, token, email_sent: bool }
//   { error } on failure (400/500)

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'

const SUPABASE_URL    = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY     = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const RESEND_API_KEY  = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM     = Deno.env.get('RESEND_FROM_EMAIL') || 'LexClause <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

function buildInviteHtml({ inviterName, orgName, role, link }) {
  return `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
  <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 50%,#3b82f6 100%);padding:24px 28px;color:#fff;">
    <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.85;font-weight:600;margin-bottom:6px;">LexClause</div>
    <div style="font-family:Georgia,'Cormorant Garamond',serif;font-size:24px;line-height:1.1;letter-spacing:-0.01em;">You're invited</div>
  </div>
  <div style="padding:28px;">
    <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 16px 0;">
      ${escapeHtml(inviterName) || 'A colleague'} invited you to join
      <strong style="color:#1d4ed8;">${escapeHtml(orgName) || 'their organization'}</strong>
      on LexClause as a <strong>${escapeHtml(role)}</strong>.
    </p>
    <p style="color:#475569;font-size:13px;line-height:1.6;margin:0 0 24px 0;">
      LexClause is a coverage priority engine — drop your policies and a complaint, and it produces a citable
      Trigger / Priority / Exhaustion opinion under the controlling state's law.
    </p>
    <p style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.02em;">
        Accept invitation
      </a>
    </p>
    <p style="color:#94a3b8;font-size:11px;margin:24px 0 0 0;">
      This invitation expires in 14 days. If the button doesn't work, copy this link:<br/>
      <a href="${link}" style="color:#2563eb;word-break:break-all;">${link}</a>
    </p>
  </div>
  <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
    <span style="font-family:Georgia,serif;color:#1d4ed8;font-weight:600;letter-spacing:0.05em;">LexClause</span>
    <span style="color:#cbd5e1;margin:0 8px;">·</span>
    <span style="color:#64748b;font-size:11px;">Coverage priority engine</span>
  </div>
</div>
</body></html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
    const authHeader = req.headers.get('Authorization') || ''
    if (!authHeader) throw new Error('Authentication required')

    const body = await req.json()
    const { email, role, app_url } = body || {}

    if (!email || !EMAIL_RE.test(String(email).trim())) {
      throw new Error('A valid recipient email is required')
    }
    if (role !== 'admin' && role !== 'member') {
      throw new Error("role must be 'admin' or 'member'")
    }
    if (!app_url || !/^https?:\/\//.test(app_url)) {
      throw new Error('app_url is required (e.g. https://lexclause.netlify.app)')
    }

    // Service-role client to bypass RLS where needed (for the lookup of the
    // caller's org and the inviter's name).
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)

    // Resolve the caller from the supplied JWT
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userResp, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userResp?.user) throw new Error('Could not identify the caller')
    const callerId = userResp.user.id

    // Pull the caller's profile + org. We only allow admins to invite.
    const { data: callerProfile, error: profErr } = await admin
      .from('lc_profiles')
      .select('id, org_id, role, first_name, last_name, email')
      .eq('id', callerId)
      .single()
    if (profErr || !callerProfile) throw new Error('Caller profile not found')
    if (callerProfile.role !== 'admin') throw new Error('Only org admins can send invitations')

    const { data: org } = await admin
      .from('lc_organizations')
      .select('id, name')
      .eq('id', callerProfile.org_id)
      .single()

    const inviterName = [callerProfile.first_name, callerProfile.last_name].filter(Boolean).join(' ') || callerProfile.email || 'A colleague'
    const orgName     = org?.name || 'your organization'
    const inviteEmail = String(email).trim().toLowerCase()

    // Insert the invitation. If the same email has a pending invite, supersede it
    // by revoking the prior one rather than stacking.
    await admin.from('lc_invitations')
      .update({ revoked_at: new Date().toISOString() })
      .eq('org_id', callerProfile.org_id)
      .eq('email',  inviteEmail)
      .is('accepted_at', null)
      .is('revoked_at',  null)

    const { data: inv, error: insErr } = await admin
      .from('lc_invitations')
      .insert({
        org_id:     callerProfile.org_id,
        email:      inviteEmail,
        role,
        invited_by: callerId,
      })
      .select()
      .single()
    if (insErr || !inv) throw new Error('Could not create the invitation: ' + (insErr?.message || ''))

    // Build the link the invitee will click. They land on /register with the
    // token in query params; Register.jsx forwards it through to signUp metadata.
    const link = `${app_url.replace(/\/$/, '')}/register?invite=${inv.token}&email=${encodeURIComponent(inviteEmail)}`

    // Send via Resend
    const html = buildInviteHtml({ inviterName, orgName, role, link })
    const subject = `${inviterName} invited you to ${orgName} on LexClause`
    let email_sent = false
    let send_error = null
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method:  'POST',
        headers: {
          'Authorization': `Bearer ${RESEND_API_KEY}`,
          'Content-Type':  'application/json',
        },
        body: JSON.stringify({
          from: RESEND_FROM,
          to:   [inviteEmail],
          subject,
          html,
        }),
      })
      const txt = await resp.text()
      if (!resp.ok) {
        send_error = `Resend ${resp.status}: ${txt.slice(0, 300)}`
      } else {
        email_sent = true
      }
    } catch (e) {
      send_error = String(e?.message || e).slice(0, 300)
    }

    return new Response(JSON.stringify({
      ok:             true,
      invitation_id:  inv.id,
      token:          inv.token,
      email,
      role,
      link,
      email_sent,
      send_error,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
