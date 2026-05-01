// supabase/functions/email-opinion/index.ts
//
// Forwards a generated coverage-priority opinion (.docx + .pdf attachments,
// produced client-side by generateCoverageMemo.js) to one or more recipients
// via Resend. Used by the Analyzer's ExportMenu → "Email opinion" flow.
//
// Required Edge Function secrets:
//   RESEND_API_KEY     — re_… token from the Resend dashboard
//   RESEND_FROM_EMAIL  — optional; defaults to "LexClause <onboarding@resend.dev>"
//
// Request body:
//   {
//     recipients: string[],           // 1-25 email addresses
//     subject:    string,             // optional; defaulted
//     message:    string|null,        // optional cover note (rendered in email body)
//     matter_name: string|null,       // optional; surfaces in subject + body
//     governing_state: string|null,   // optional; surfaces in body
//     attachments: [
//       { filename: string, content_base64: string, content_type?: string }
//     ]
//   }
//
// Response:
//   { ok: true, id: string, sent_to: string[] }
// or { error: string } with 400/500.

// @ts-nocheck
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const RESEND_FROM    = Deno.env.get('RESEND_FROM_EMAIL') || 'LexClause <onboarding@resend.dev>'

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function buildHtmlBody({ matter_name, governing_state, message }) {
  const subjectLine = matter_name
    ? `Coverage Priority Opinion · ${matter_name}`
    : 'Coverage Priority Opinion'
  const govLine = governing_state ? `<p style="color:#475569;font-size:13px;margin:0 0 16px 0;">Governing law: <strong style="color:#0f172a;">${escapeHtml(governing_state)}</strong></p>` : ''
  const noteBlock = message
    ? `<div style="color:#334155;font-size:14px;line-height:1.6;margin:24px 0;padding:16px;background:#eff6ff;border-left:3px solid #2563eb;border-radius:4px;">${escapeHtml(message).replace(/\n/g, '<br>')}</div>`
    : ''

  return `<!doctype html>
<html>
<body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
    <div style="background:linear-gradient(135deg,#1d4ed8 0%,#2563eb 50%,#3b82f6 100%);padding:24px 28px;color:#fff;">
      <div style="font-size:11px;letter-spacing:0.22em;text-transform:uppercase;opacity:0.85;font-weight:600;margin-bottom:6px;">LexClause</div>
      <div style="font-family:Georgia,'Cormorant Garamond',serif;font-size:24px;line-height:1.1;letter-spacing:-0.01em;">${escapeHtml(subjectLine)}</div>
    </div>
    <div style="padding:28px;">
      ${govLine}
      <p style="color:#0f172a;font-size:15px;line-height:1.6;margin:0 0 16px 0;">
        The full coverage priority opinion is attached.
      </p>
      ${noteBlock}
      <p style="color:#475569;font-size:13px;line-height:1.5;margin:24px 0 0 0;">
        The opinion analyzes which policies are triggered, in what priority order they respond,
        and the controlling exhaustion rule under the governing state's law. Citations are drawn
        from a curated state-supreme-court catalog; the engine is forbidden from fabricating authority.
      </p>
      <p style="color:#94a3b8;font-size:11px;font-style:italic;margin-top:20px;line-height:1.5;">
        This is draft work product to assist coverage counsel — not legal advice. Verify all citations
        and conclusions before relying on them, especially in jurisdictions where coverage law has
        shifted recently.
      </p>
    </div>
    <div style="padding:14px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;text-align:center;">
      <span style="font-family:Georgia,serif;color:#1d4ed8;font-weight:600;letter-spacing:0.05em;">LexClause</span>
      <span style="color:#cbd5e1;margin:0 8px;">·</span>
      <span style="color:#64748b;font-size:11px;letter-spacing:0.05em;">Coverage priority engine</span>
    </div>
  </div>
</body>
</html>`
}

function escapeHtml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured')
    const body = await req.json()
    const {
      recipients = [],
      subject,
      message,
      matter_name,
      governing_state,
      attachments = [],
    } = body || {}

    // ── Validation ──────────────────────────────────────────────────────────
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error('At least one recipient is required')
    }
    if (recipients.length > 25) {
      throw new Error('Too many recipients (max 25 per send)')
    }
    const valid   = recipients.map(s => String(s).trim().toLowerCase()).filter(e => EMAIL_RE.test(e))
    const invalid = recipients.filter(e => !EMAIL_RE.test(String(e).trim()))
    if (valid.length === 0) throw new Error('No valid recipient emails')

    if (!Array.isArray(attachments) || attachments.length === 0) {
      throw new Error('At least one attachment is required')
    }
    for (const a of attachments) {
      if (!a?.filename || !a?.content_base64) {
        throw new Error('Each attachment must include filename + content_base64')
      }
    }
    // Soft cap: Resend's hard limit on attachment payload is ~25 MB combined.
    // Each base64 char is ~0.75 bytes; cap raw base64 length at ~30 MB.
    const totalBase64 = attachments.reduce((s, a) => s + (a.content_base64?.length || 0), 0)
    if (totalBase64 > 30_000_000) {
      throw new Error('Attachments exceed combined size limit (~22 MB).')
    }

    // ── Send via Resend ─────────────────────────────────────────────────────
    const finalSubject = subject || (matter_name
      ? `Coverage Priority Opinion · ${matter_name}`
      : 'Coverage Priority Opinion')

    const html = buildHtmlBody({ matter_name, governing_state, message })

    const resendBody = {
      from: RESEND_FROM,
      to:   valid,
      subject: finalSubject,
      html,
      attachments: attachments.map(a => ({
        filename: a.filename,
        content:  a.content_base64,
        // Resend infers content type from filename extension; pass content_type
        // only when explicitly provided.
        ...(a.content_type ? { content_type: a.content_type } : {}),
      })),
    }

    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(resendBody),
    })
    const respText = await resp.text()
    if (!resp.ok) {
      // Bubble the Resend error message up to the user
      let msg = respText
      try {
        const j = JSON.parse(respText)
        msg = j.message || j.error || respText
      } catch {}
      throw new Error(`Resend ${resp.status}: ${String(msg).slice(0, 600)}`)
    }
    const data = JSON.parse(respText)

    return new Response(JSON.stringify({
      ok:        true,
      id:        data.id || null,
      sent_to:   valid,
      ignored:   invalid,
      from:      RESEND_FROM,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message || e) }), {
      status:  500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
