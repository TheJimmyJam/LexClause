/**
 * Terms of Service — public page.
 *
 * NOTE TO MAINTAINER: This is a template document drafted to match the
 * product's actual behavior. Before public launch, have an attorney review
 * and adjust to your business specifics (jurisdiction, entity name,
 * arbitration / class-action waiver decisions, indemnification scope, etc.).
 */

import { Link } from 'react-router-dom'
import { ChevronRight, ArrowLeft } from 'lucide-react'

const EFFECTIVE_DATE = 'May 1, 2026'

export default function Terms() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <LegalNav />

      <article className="max-w-3xl mx-auto px-6 lg:px-8 py-12 lg:py-16">
        <header className="mb-10 pb-6 border-b border-slate-200">
          <p className="text-[11px] font-semibold tracking-[0.22em] uppercase text-brand-700 mb-2">
            LexClause
          </p>
          <h1 className="font-serif-brand text-4xl lg:text-5xl tracking-tight leading-none mb-4">
            <span className="lc-title-underline uppercase">Terms of Service</span>
          </h1>
          <p className="text-sm text-slate-500">Effective {EFFECTIVE_DATE}</p>
        </header>

        <Section n="1" title="What LexClause is">
          <p>
            LexClause is software that helps coverage counsel analyze insurance policies. It reads
            uploaded policies and a complaint (or pre-suit demand, or reservation-of-rights letter),
            applies the controlling state's law, and produces a draft <strong>coverage priority opinion</strong>
            — telling you which policies are triggered, in what priority order they respond, and how the
            tower exhausts.
          </p>
          <p>
            <strong>LexClause is software. It is not a law firm. It is not a lawyer.</strong> It does not
            give legal advice. The opinions it generates are draft work product to assist coverage counsel.
            You agree to verify all citations, conclusions, and policy interpretations before relying on them.
          </p>
        </Section>

        <Section n="2" title="Your account">
          <p>
            To use LexClause you must create an account and acknowledge the disclaimer at signup.
            You're responsible for keeping your login credentials secure and for everything that happens
            under your account. Tell us right away if you suspect unauthorized access.
          </p>
          <p>
            You must be at least 18 and have authority to bind your organization to these Terms.
          </p>
        </Section>

        <Section n="3" title="Acceptable use">
          <p>You agree not to:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>Use LexClause to provide legal advice or hold yourself out as a lawyer if you aren't one.</li>
            <li>Upload documents you don't have the right to upload, or that contain another party's privileged information without authorization.</li>
            <li>Reverse engineer the software, scrape it, or attempt to extract the underlying state-law catalog or prompts.</li>
            <li>Use the service to harass, defame, or harm any person.</li>
            <li>Bypass authentication, rate limits, or other security controls.</li>
          </ul>
        </Section>

        <Section n="4" title="Your content">
          <p>
            You keep all rights to the policies, complaints, and other documents you upload, and to the
            opinions LexClause generates from them ("Your Content"). You grant LexClause a limited
            license to process Your Content solely to provide the service to you — including running it
            through our LLM provider, storing it for your retrieval, and emailing it to recipients you
            specify.
          </p>
          <p>
            That license ends when you delete the content or close your account. We do not use Your
            Content to train AI models. We do not sell or rent it. See the{' '}
            <Link to="/privacy" className="text-brand-700 hover:text-brand-800 underline font-medium">
              Privacy Policy
            </Link>{' '}
            for the full picture.
          </p>
        </Section>

        <Section n="5" title="Our content">
          <p>
            LexClause owns the software, the curated state-law catalog, the prompts, and everything else
            that's "the service." You get a non-exclusive, non-transferable right to use the service
            while your account is in good standing. That's it — you don't get to copy, sublicense, or
            create derivative works.
          </p>
        </Section>

        <Section n="6" title="Fees">
          <p>
            If your plan has a fee, we'll show it before you commit. Fees are billed in advance and are
            non-refundable except where required by law. We may change pricing on prospective billing
            cycles with reasonable notice.
          </p>
        </Section>

        <Section n="7" title="No legal advice. No warranty.">
          <p>
            <strong>The output is a draft, not legal advice.</strong> LexClause's analyses can be wrong.
            State law shifts. LLMs hallucinate. The curated catalog has gaps. You — a licensed attorney
            applying your independent professional judgment — are the only person who can decide whether
            an opinion is correct, complete, and usable in a particular matter.
          </p>
          <p>
            The service is provided <strong>"AS IS"</strong> and <strong>"AS AVAILABLE"</strong>. To the
            fullest extent permitted by law, LexClause disclaims all warranties, express or implied,
            including merchantability, fitness for a particular purpose, accuracy, and non-infringement.
          </p>
        </Section>

        <Section n="8" title="Limitation of liability">
          <p>
            To the fullest extent permitted by law, LexClause is not liable for any indirect,
            incidental, consequential, special, or punitive damages, or for lost profits, lost data, or
            business interruption, even if we've been advised of the possibility. Our aggregate
            liability for any claim arising out of or related to the service is limited to the greater
            of (a) the fees you paid in the twelve months before the claim, or (b) USD $100.
          </p>
          <p>
            Some jurisdictions don't allow these limits. To the extent yours doesn't, the limit applies
            to the maximum extent permitted.
          </p>
        </Section>

        <Section n="9" title="Indemnification">
          <p>
            You will defend, indemnify, and hold LexClause harmless from any third-party claims arising
            out of (a) your use of the service in violation of these Terms, (b) your content, or (c)
            your reliance on a draft opinion without independent legal review.
          </p>
        </Section>

        <Section n="10" title="Termination">
          <p>
            You can close your account at any time. We can suspend or terminate accounts that violate
            these Terms, or where required by law or to protect the service. On termination, your right
            to use the service ends; sections of these Terms that should reasonably survive (IP,
            disclaimers, limitation of liability, indemnification) will survive.
          </p>
        </Section>

        <Section n="11" title="Governing law">
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to conflict-of-law
            principles. The exclusive forum for disputes is the state and federal courts located in
            Dallas County, Texas, and you consent to personal jurisdiction there.
          </p>
        </Section>

        <Section n="12" title="Changes">
          <p>
            We may update these Terms. If a change is material, we'll let you know in-app or by email
            before it takes effect. Continued use after the effective date means you accept the
            updated Terms.
          </p>
        </Section>

        <Section n="13" title="Contact">
          <p>
            Questions about these Terms? Email{' '}
            <a href="mailto:legal@lexclause.com" className="text-brand-700 hover:text-brand-800 underline font-medium">
              legal@lexclause.com
            </a>.
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

export function LegalNav() {
  return (
    <nav className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-10 py-3 bg-white/95 backdrop-blur border-b border-slate-200">
      <Link to="/" className="flex items-center gap-2.5 text-slate-700 hover:text-brand-700 transition-colors">
        <ArrowLeft className="h-3.5 w-3.5" />
        <img src="/logo-icon.png" alt="LexClause" className="w-7 h-7 rounded-md ring-1 ring-brand-200/70" />
        <span className="font-serif-brand text-base text-slate-900">LexClause</span>
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/terms" className="text-slate-600 hover:text-brand-700 transition-colors">Terms</Link>
        <Link to="/privacy" className="text-slate-600 hover:text-brand-700 transition-colors">Privacy</Link>
        <Link to="/login" className="text-brand-700 hover:text-brand-800 font-semibold transition-colors inline-flex items-center gap-1">
          Log in <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  )
}

export function LegalFooter() {
  return (
    <footer className="mt-16 pt-8 border-t border-slate-200 text-center text-xs text-slate-500">
      <div className="mb-2">
        <Link to="/terms"   className="hover:text-brand-700 mx-3">Terms</Link>
        <Link to="/privacy" className="hover:text-brand-700 mx-3">Privacy</Link>
        <Link to="/"        className="hover:text-brand-700 mx-3">Home</Link>
      </div>
      <div>
        © {new Date().getFullYear()} LexClause · <span className="font-serif-brand text-brand-700">Coverage priority engine</span>
      </div>
    </footer>
  )
}
