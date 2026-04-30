import { Link } from 'react-router-dom'
import {
  Scale, Shield, ArrowRight, Upload, FileSearch,
  Map, Layers, Gavel, ChevronRight, BookOpen,
} from 'lucide-react'

const features = [
  {
    icon: Upload,
    color: 'bg-teal-500/20 text-teal-300',
    title: 'AI Policy Ingestion',
    desc: 'Drop in a stack of CGL, umbrella, and excess PDFs. Claude extracts limits, retentions, other-insurance language, and endorsements into structured data — ready to analyze.',
  },
  {
    icon: FileSearch,
    color: 'bg-cyan-500/20 text-cyan-300',
    title: 'Other-Insurance Reconciliation',
    desc: 'Pro-rata, excess, escape, primary-non-contributory — LexClause reads each policy\'s clause and surfaces conflicts before they become disputes.',
  },
  {
    icon: Layers,
    color: 'bg-emerald-500/20 text-emerald-300',
    title: 'Trigger of Coverage',
    desc: 'Continuous, exposure, manifestation, injury-in-fact. Map facts to triggered policy years across long-tail losses — environmental, construction defect, mass tort.',
  },
  {
    icon: Map,
    color: 'bg-blue-500/20 text-blue-300',
    title: 'Multi-State Choice of Law',
    desc: 'Loss in TX, policies issued in NY, additional-insured under a CA policy? LexClause identifies candidate jurisdictions and runs each analysis side-by-side.',
  },
  {
    icon: Gavel,
    color: 'bg-amber-500/20 text-amber-300',
    title: 'State-Law Engine',
    desc: 'All-sums, pro-rata-by-time-on-risk, targeted tender, horizontal vs. vertical exhaustion. Coded rules — not LLM guesses — apply the controlling law.',
  },
  {
    icon: BookOpen,
    color: 'bg-rose-500/20 text-rose-300',
    title: 'Audit-Ready Memos',
    desc: 'Each analysis exports as a coverage-opinion memo with citations, methodology, and per-carrier shares. Defensible output, ready for the file.',
  },
]

const steps = [
  { num: '01', title: 'Upload Policies',  desc: 'Drop in policy PDFs. AI extracts terms, limits, and other-insurance language.' },
  { num: '02', title: 'Define the Loss',  desc: 'Loss type, dates, jurisdictions, plaintiffs. Choose a trigger theory or let the analyzer suggest one.' },
  { num: '03', title: 'Apply State Law',  desc: 'LexClause identifies the candidate governing states and applies their allocation rules.' },
  { num: '04', title: 'Allocate & Export',desc: 'Per-carrier shares with full methodology. Export as a coverage memo.' },
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
            <div className="text-slate-400 text-[11px] mt-0.5">Coverage Share Analysis</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">Log In</Link>
          <Link to="/register" className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-400 text-white text-sm font-semibold rounded-lg transition-colors">
            Sign Up <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </nav>

      <section className="relative px-6 lg:px-16 pt-16 pb-28 text-center overflow-hidden">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-brand-600/20 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-4xl mx-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/5 border border-white/10 rounded-full text-xs text-slate-300 mb-6">
            <Shield className="h-3.5 w-3.5 text-brand-400" />
            Built for coverage counsel
          </div>
          <h1 className="text-5xl lg:text-7xl font-extrabold leading-tight mb-6 tracking-tight">
            Allocate Coverage<br />
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">By the Policy Language.</span>
          </h1>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Multi-policy, multi-state coverage allocation backed by real state-law rules.
            Built for coverage counsel, claims professionals, and risk managers.
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
        </div>
      </section>

      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-3">How It Works</h2>
          <p className="text-slate-400">From policy stack to coverage memo in four steps.</p>
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

      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="text-4xl font-bold mb-3">What LexClause Sees</h2>
          <p className="text-slate-400">The hard parts of a coverage analysis — built into the platform.</p>
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

      <section className="px-6 lg:px-16 py-20">
        <div className="max-w-3xl mx-auto text-center bg-gradient-to-br from-brand-600/20 to-cyan-600/10 border border-brand-500/20 rounded-3xl p-12">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4">Stop running coverage analyses in spreadsheets.</h2>
          <p className="text-slate-300 mb-8">
            Upload a policy stack, define the loss, pick the controlling state. LexClause produces a defensible per-carrier allocation with citations — in minutes, not weeks.
          </p>
          <Link to="/register"
            className="inline-flex items-center gap-2 px-7 py-3.5 bg-brand-500 hover:bg-brand-400 text-white font-semibold rounded-xl transition-all shadow-lg shadow-brand-500/25">
            Get Started <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="px-6 lg:px-16 py-8 border-t border-white/5 text-center text-slate-500 text-sm">
        © {new Date().getFullYear()} LexClause · Coverage allocation, made defensible
      </footer>
    </div>
  )
}
