import { Link } from 'react-router-dom'
import {
  Scale, Shield, ArrowRight, Upload, FileSearch,
  Map, Layers, Gavel, ChevronRight, BookOpen,
  CheckCircle2, Calculator, FileCheck,
} from 'lucide-react'

const features = [
  {
    icon: Upload,
    color: 'bg-teal-500/20 text-teal-300',
    title: 'AI policy ingestion',
    desc: 'Drop in CGL, umbrella, and excess PDFs. Limits, retentions, attachment points, other-insurance language, exclusions, and endorsements come out as structured data — verbatim quotes preserved for the operative clauses.',
  },
  {
    icon: FileSearch,
    color: 'bg-cyan-500/20 text-cyan-300',
    title: 'Other-insurance reconciliation',
    desc: 'Primary, excess, pro-rata, escape, primary-and-non-contributory, follows-form. LexClause classifies each clause and resolves mutual repugnancies the way the controlling state does — not by gut feel.',
  },
  {
    icon: Layers,
    color: 'bg-emerald-500/20 text-emerald-300',
    title: 'Trigger of coverage',
    desc: 'Continuous, exposure, manifestation, injury-in-fact, actual-injury. The right trigger by jurisdiction, applied to your loss period, with a clear list of which policy years respond.',
  },
  {
    icon: Map,
    color: 'bg-blue-500/20 text-blue-300',
    title: 'Multi-state choice of law',
    desc: 'Loss in TX, policies issued in NY, additional-insured under a CA policy? LexClause surfaces every candidate jurisdiction and runs the analysis under each — so the choice-of-law fight is a feature, not an afterthought.',
  },
  {
    icon: Gavel,
    color: 'bg-amber-500/20 text-amber-300',
    title: 'Coded state-law engine',
    desc: 'All-sums, pro-rata-by-time, pro-rata-by-limits, targeted tender, horizontal vs. vertical exhaustion. Twenty states seeded with anchor citations — Montrose, Owens-Illinois, Carter-Wallace, Viking Pump, Goodyear, Wallis. Rules in code, not in a prompt.',
  },
  {
    icon: BookOpen,
    color: 'bg-rose-500/20 text-rose-300',
    title: 'Audit-ready memos',
    desc: 'Each analysis exports as a Word or PDF coverage memo: tower structure, methodology with citations, per-carrier rationales, and a reconciliation note that proves the math sums to the exposure.',
  },
]

const steps = [
  { num: '01', title: 'Upload the tower', desc: 'Drop in policy PDFs. Carriers, limits, attachment points, and operative clauses come out structured.' },
  { num: '02', title: 'Define the loss',  desc: 'Loss type, dates, jurisdictions, damages exposure. Pick the trigger or accept the state default.' },
  { num: '03', title: 'Apply the rule',   desc: 'LexClause classifies each policy by layer, applies the controlling state\'s allocation rule, and runs the math.' },
  { num: '04', title: 'Validate & export',desc: 'Built-in validator: every carrier amount is within limits, totals reconcile to the penny. Export Word or PDF.' },
]

// Doctrine groupings for the catalog credibility strip
const doctrineCatalog = [
  { rule: 'All-sums',                states: ['CA', 'OH', 'WA', 'MN', 'IN', 'MO', 'WI'] },
  { rule: 'Pro-rata by time on risk', states: ['NY', 'NJ', 'CT', 'MA', 'PA', 'DE', 'NC', 'GA', 'OR', 'FL', 'CO'] },
  { rule: 'Pro-rata by limits',      states: ['TX'] },
  { rule: 'Targeted tender',         states: ['IL'] },
]

// Trust pillars
const pillars = [
  {
    icon: Calculator,
    title: 'The math reconciles.',
    desc: 'A deterministic post-validator checks every allocation against your damages exposure and each policy\'s applicable limit. If it doesn\'t reconcile, the engine self-corrects and retries — or flags the analysis for review. No silent rounding errors.',
  },
  {
    icon: FileCheck,
    title: 'Citations come from a vetted catalog.',
    desc: 'Twenty states with anchor cases curated against the actual reporters. The engine is told to use those citations and only those citations — fabrication is forbidden in the prompt and verified in the memo.',
  },
  {
    icon: Shield,
    title: 'Two layers, by design.',
    desc: 'Claude reads policy language and drafts the memo. A coded rules layer in TypeScript and Postgres decides the binding allocation. You can defend the architecture in a CLE talk; you couldn\'t defend a single-LLM blob.',
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4 bg-slate-950/90 backdrop-blur border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center shadow-lg shadow-brand-600/30">
            <Scale className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-bold text-lg leading-none">LexClause</div>
            <div className="text-slate-400 text-[11px] mt-0.5">Coverage Allocation</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">Log In</Link>
          <Link to="/register" className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-lg transition-colors">
            Sign Up <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative px-6 lg:px-16 pt-16 pb-24 text-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 mb-6">
            <Shield className="h-3.5 w-3.5 text-brand-400" />
            Built for coverage counsel
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold leading-[1.05] mb-6 tracking-tight">
            From policy stack<br />
            to coverage memo.<br />
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">With citations that hold up.</span>
          </h1>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Upload the tower. Pick the governing state. LexClause runs the trigger, applies the state-law rule,
            and produces a per-carrier allocation memo with vetted citations — in minutes, not weeks.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/register"
              className="flex items-center gap-2 px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25 hover:-translate-y-0.5">
              Get Started <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/login"
              className="flex items-center gap-2 px-7 py-3.5 bg-white/8 hover:bg-white/15 text-white font-medium rounded-xl border border-white/15 transition-all">
              Log In
            </Link>
          </div>

          {/* Trust micro-strip */}
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-12 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 20 states catalogued</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Math validates against limits</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Citations from vetted catalog</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Word + PDF export</span>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-3">How it works</h2>
          <p className="text-slate-400">Four steps from PDFs to a defensible memo.</p>
        </div>
        <div className="grid md:grid-cols-4 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-brand-400 font-bold text-sm mb-3">{s.num}</div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-3">Built for the hard parts</h2>
          <p className="text-slate-400">The things coverage attorneys actually fight about.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((f) => {
            const Icon = f.icon
            return (
              <div key={f.title} className="bg-white/5 border border-white/10 rounded-2xl p-6 hover:border-brand-500/40 transition-colors">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${f.color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── State-law catalog credibility strip ──────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-3">A coded catalog of state coverage law</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Twenty jurisdictions seeded with vetted anchor citations. The engine looks up the rule and pulls the cite — it doesn't make either up.
          </p>
        </div>
        <div className="space-y-3 max-w-4xl mx-auto">
          {doctrineCatalog.map((d) => (
            <div key={d.rule} className="flex items-start gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
              <div className="text-brand-400 font-mono text-xs uppercase tracking-wider whitespace-nowrap min-w-[180px] mt-0.5">
                {d.rule}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {d.states.map(s => (
                  <span key={s} className="inline-flex items-center justify-center w-9 h-7 bg-slate-800 border border-white/10 rounded text-[11px] font-mono font-medium text-slate-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6">
          Anchor cases include <span className="text-slate-300">Montrose I &amp; II</span>, <span className="text-slate-300">Owens-Illinois</span>, <span className="text-slate-300">Carter-Wallace</span>, <span className="text-slate-300">Consol. Edison</span>, <span className="text-slate-300">Viking Pump</span>, <span className="text-slate-300">Boston Gas</span>, <span className="text-slate-300">Don's Building Supply</span>, <span className="text-slate-300">Goodyear v. Aetna</span>, <span className="text-slate-300">Public Service v. Wallis</span>, <span className="text-slate-300">Plastics Engineering</span>.
        </p>
      </section>

      {/* ── Trust pillars ────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-3">Why the output is defensible</h2>
          <p className="text-slate-400">Three architectural commitments, not three taglines.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {pillars.map(p => {
            const Icon = p.icon
            return (
              <div key={p.title} className="p-6 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/10">
                <div className="w-10 h-10 rounded-lg bg-brand-500/20 text-brand-300 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-lg mb-2">{p.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{p.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Honest disclaimer ────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-12 max-w-4xl mx-auto">
        <div className="text-center text-slate-500 text-sm">
          LexClause produces draft work product. It's not a substitute for an attorney's judgment. Verify citations and conclusions before relying on them — especially in jurisdictions where coverage law has shifted recently.
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-brand-600/20 to-cyan-600/10 border border-brand-500/20 rounded-3xl p-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Stop running coverage allocations in spreadsheets.</h2>
          <p className="text-slate-300 mb-8">
            The first matter is free. Upload your policy stack and see what a real allocation memo looks like in under five minutes.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 lg:px-16 py-8 border-t border-white/5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div>© {new Date().getFullYear()} LexClause</div>
          <div>Coverage allocation, made defensible</div>
        </div>
      </footer>
    </div>
  )
}
