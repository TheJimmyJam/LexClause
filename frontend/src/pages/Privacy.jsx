/**
 * Privacy Policy — public page.
 *
 * Centerpiece commitment: we do not sell or rent user data. We use it only to
 * provide the service. The service providers we list are real (Supabase,
 * Anthropic, Resend, Netlify) — keep this list accurate as the stack changes.
 *
 * NOTE TO MAINTAINER: This is a template document drafted to match the
 * product's actual behavior. Before public launch, have an attorney review
 * and adjust to your business specifics (entity name, jurisdiction, GDPR /
 * CCPA disclosures, retention timelines).
 */

import { Link } from 'react-router-dom'
import { Shield } from 'lucide-react'
import { LegalNav, LegalFooter } from './Terms.jsx'

const EFFECTIVE_DATE = 'May 1, 2026'

export default function Privacy() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LegalNav />

      <article className="max-w-3xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-10 pb-6 border-b border-slate-200">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700 mb-2">
            LexClause
          </p>
          <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight leading-none mb-4">
            <span className="lc-title-underline uppercase">Privacy Policy</span>
          </h1>
          <p className="text-sm text-slate-500">Effective {EFFECTIVE_DATE}</p>
        </header>

        {/* Headline commitment — sets the tone for the whole policy */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/60 p-5 mb-10 flex items-start gap-3">
          <Shield className="h-5 w-5 text-brand-700 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-slate-900 font-semibold mb-1">
              We do not sell, rent, or trade your data. Ever.
            </p>
            <p className="text-sm text-slate-700 leading-relaxed">
              We use what you give us only to provide the service to you — running coverage analyses,
              storing your past matters, and delivering opinions you ask us to deliver. Nothing else.
              We do not run ads. We do not sell anonymized data. We do not train AI models on your content.
            </p>
          </div>
        </div>

        <Section n="1" title="What we collect">
          <p>We collect three buckets of data:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>
              <strong>Account information</strong> — your email, your name, your organization's name, and
              the disclaimer acknowledgment timestamp from when you signed up. Authentication is handled
              by Supabase Auth; we do not store your password (a hashed credential lives with Supabase Auth).
            </li>
            <li>
              <strong>Documents you upload</strong> — insurance policies, complaints, pre-suit demands,
              reservation-of-rights letters, and any other PDFs you drop into the Analyzer. These are
              stored encrypted in Supabase Storage, scoped to your organization by row-level security.
            </li>
            <li>
              <strong>Generated outputs</strong> — the structured fields the engine extracts from each
              document, the Trigger / Priority / Exhaustion opinions it produces, and the audit metadata
              (validation status, retry attempts, citations). Stored in your organization's tables.
            </li>
          </ul>
          <p>
            We also collect minimal operational logs (request timestamps, error traces) to keep the
            service running. These don't include the contents of your documents.
          </p>
        </Section>

        <Section n="2" title="How we use it">
          <p>We use your data <strong>only</strong> to:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Authenticate you and protect your account.</li>
            <li>Run the analyses you ask us to run — extracting fields from policies, parsing allegations from complaints, producing coverage priority opinions.</li>
            <li>Store your past matters so you can come back to them.</li>
            <li>Send the opinion to recipients you specify (email export feature).</li>
            <li>Diagnose problems, prevent abuse, and improve reliability.</li>
            <li>Comply with legal obligations.</li>
          </ul>
          <p>That's the whole list.</p>
        </Section>

        <Section n="3" title="Who else touches your data">
          <p>
            We use a small number of service providers ("data processors") to run the service. Each one
            handles your data only on our behalf, only for the specific purpose listed, and is bound by a
            data processing agreement that prohibits using it for anything else:
          </p>
          <ul className="list-disc pl-6 space-y-1.5 mt-2">
            <li>
              <strong>Supabase</strong> — hosts the database, authentication, and storage. Your account
              data, documents, and generated opinions live in Supabase infrastructure.
            </li>
            <li>
              <strong>Anthropic (Claude)</strong> — the LLM that classifies documents, extracts policy
              terms and allegations, and drafts coverage priority opinions. Document content is sent to
              Anthropic's API <em>only</em> at the moment of analysis. Per Anthropic's data processing
              terms, content sent through the API is not used to train Anthropic's models.
            </li>
            <li>
              <strong>Resend</strong> — handles email delivery when you send an opinion to a recipient.
              Resend sees the recipient list, the email body, and the attached opinion (which you chose
              to send).
            </li>
            <li>
              <strong>Netlify</strong> — hosts the LexClause web application. Netlify sees standard web
              traffic (IP, browser type) but not document content.
            </li>
          </ul>
          <p>
            We do not share your data with advertisers, data brokers, or analytics vendors. We do not
            sell, rent, lease, or trade it. We do not allow our processors to use it for their own
            purposes.
          </p>
        </Section>

        <Section n="4" title="What we don't do">
          <p>
            We don't run third-party advertising. We don't have a business model that depends on
            monetizing your information. We don't aggregate your matters into "industry insights" we
            then sell. We don't fine-tune AI models on your content. If we ever consider any of those
            things, we'd require your explicit opt-in first — and the default would still be no.
          </p>
        </Section>

        <Section n="5" title="Cookies and tracking">
          <p>
            We use only the cookies necessary to keep you logged in (session cookies set by Supabase
            Auth). We don't use third-party tracking pixels, ad cookies, or cross-site analytics. We
            don't sell or share clickstream data because we don't collect it.
          </p>
        </Section>

        <Section n="6" title="How long we keep it">
          <p>
            We keep your account data and documents for as long as your account is active. If you
            delete a matter, the matter row plus the associated policies and analyses are removed from
            the database; storage objects (the original PDFs) are removed shortly after. If you close
            your account, all of your content is deleted within 30 days unless we're legally required
            to retain a portion for a specific purpose (in which case we retain only what's required,
            for the period required, and securely delete after).
          </p>
          <p>
            Operational logs (error traces, security events) are retained on a rolling basis — typically
            up to 90 days — and don't include document contents.
          </p>
        </Section>

        <Section n="7" title="Security">
          <p>
            All traffic is encrypted in transit (HTTPS/TLS). Data at rest in Supabase is encrypted.
            Every database table is gated by row-level security policies that isolate one organization's
            data from another's. Storage buckets are private and require service-level credentials.
            Anthropic API calls go over TLS; the API key is held server-side only — your browser never
            sees it.
          </p>
          <p>
            That said, no system is perfectly secure. If a breach affects your data, we'll notify you
            promptly and explain what happened.
          </p>
        </Section>

        <Section n="8" title="Your choices">
          <p>You can:</p>
          <ul className="list-disc pl-6 space-y-1.5">
            <li><strong>Access</strong> your data — past matters and analyses are visible to you in-app at any time.</li>
            <li><strong>Export</strong> any opinion as .docx or .pdf at any time.</li>
            <li><strong>Delete</strong> a specific matter (and everything attached to it) by removing it from your matters list.</li>
            <li><strong>Close your account</strong> — email{' '}
              <a href="mailto:privacy@lexclause.com" className="text-brand-700 hover:text-brand-800 underline font-medium">
                privacy@lexclause.com
              </a>{' '}and we'll delete everything within 30 days.</li>
            <li><strong>Object or restrict</strong> a particular use — write to us and we'll work it out.</li>
          </ul>
        </Section>

        <Section n="9" title="Children">
          <p>
            LexClause is for licensed attorneys and the people who work with them. It's not directed at
            anyone under 18, and we don't knowingly collect data from minors.
          </p>
        </Section>

        <Section n="10" title="International users">
          <p>
            LexClause is operated from the United States. If you access the service from elsewhere, you
            understand your data is processed in the U.S. and possibly other jurisdictions where our
            service providers operate. We apply the same protections regardless.
          </p>
        </Section>

        <Section n="11" title="Changes">
          <p>
            We may update this policy. If a change is material — for instance, a change in what we
            collect or who we share it with — we'll notify you in-app or by email before it takes
            effect. The "Effective" date at the top of this page reflects the most recent revision.
          </p>
        </Section>

        <Section n="12" title="Contact">
          <p>
            Privacy questions, requests, or concerns? Email{' '}
            <a href="mailto:privacy@lexclause.com" className="text-brand-700 hover:text-brand-800 underline font-medium">
              privacy@lexclause.com
            </a>. We answer.
          </p>
        </Section>

        <LegalFooter />
      </article>
    </div>
  )
}

function Section({ n, title, children }) {
  return (
    <section className="mb-9">
      <h2 className="text-base font-semibold text-slate-900 mb-3 flex items-baseline gap-2">
        <span className="text-brand-300 font-mono text-xs tracking-wider mt-0.5">§{n}</span>
        <span className="uppercase tracking-wide">{title}</span>
      </h2>
      <div className="prose prose-slate prose-sm max-w-none text-slate-700 leading-relaxed [&_p]:mb-3 [&_p:last-child]:mb-0 [&_ul]:mb-3 [&_strong]:text-slate-900">
        {children}
      </div>
    </section>
  )
}
