import { Link } from 'react-router-dom'
import {
  Shield, ArrowRight, Upload, ScrollText,
  Map, Scale, Gavel, ChevronRight, BookOpen,
  CheckCircle2, FileSearch, Sparkles, FileCheck,
} from 'lucide-react'

const features = [
  {
    icon: Upload,
    color: 'bg-brand-500/20 text-brand-300',
    title: 'One-bucket intake',
    desc: "Drop every PDF — CGL, contractor's pollution, professional, builder's risk, umbrella, excess, plus the complaint or pre-suit demand. LexClause auto-classifies each file and routes it to the right extractor. No labels, no folders, no wizards.",
  },
  {
    icon: ScrollText,
    color: 'bg-cyan-500/20 text-cyan-300',
    title: 'Trigger / duty-to-defend',
    desc: "For each policy, LexClause applies the state's potentiality-of-coverage test against the actual allegations. Eight-corners, four-corners, extrinsic-evidence, continuous-trigger — the right test for the right jurisdiction, with the specific allegation and exclusion that drives the answer.",
  },
  {
    icon: Scale,
    color: 'bg-emerald-500/20 text-emerald-300',
    title: 'Other-insurance priority',
    desc: 'Among triggered policies, who is primary and who is excess? LexClause compares Other Insurance clauses verbatim, applies the state-specific rule, and surfaces mutually-repugnant groups with the controlling tiebreaker — pro-rata, equal shares, closest-to-the-risk, or targeted tender.',
  },
  {
    icon: Shield,
    color: 'bg-violet-500/20 text-violet-300',
    title: 'Vertical vs. horizontal exhaustion',
    desc: 'The exhaustion rule changes which excess attaches when. LexClause names the rule for the governing state and walks the tower so you know whether one primary collapses straight up or whether all primaries have to exhaust first.',
  },
  {
    icon: Map,
    color: 'bg-amber-500/20 text-amber-300',
    title: 'Multi-state comparison',
    desc: 'Same matter, three jurisdictions side-by-side. See exactly how the priority order shifts under TX vs. NY vs. CA — with the controlling case for each. The choice-of-law fight stops being a guess.',
  },
  {
    icon: BookOpen,
    color: 'bg-rose-500/20 text-rose-300',
    title: 'Citations from a vetted catalog',
    desc: "Thirty states catalogued with controlling state-supreme-court (or controlling federal-circuit) decisions. The engine is pinned to those citations and forbidden from inventing others. If the catalog is silent, the opinion says so plainly.",
  },
]

const steps = [
  { num: '01', title: 'Drop everything in',  desc: 'Policies, complaints, pre-suit demands, RORs — all into one drop zone. Each file is auto-classified.' },
  { num: '02', title: 'Confirm and run',     desc: 'LexClause detects the venue, picks the governing state, and runs the analysis. Optional multi-state comparison.' },
  { num: '03', title: 'Read the opinion',    desc: 'Trigger / Priority / Exhaustion + a 2-3 paragraph narrative. Every conclusion traces to a citation in the catalog.' },
]

// State-law catalog credibility strip — by exhaustion doctrine and trigger rule
const doctrineCatalog = [
  {
    rule:   'Vertical exhaustion',
    note:   'An excess attaches once the directly-underlying primary is exhausted.',
    states: ['CA','NY','TX','FL','OH','WA','OR','MO','GA','VA','SC','TN','IA','KY'],
  },
  {
    rule:   'Horizontal exhaustion',
    note:   'All primaries across all triggered years must exhaust before any excess attaches.',
    states: ['IL','NJ','MA','PA','CT','MN','MI','IN','WI','CO','DE','MD','LA','NH','RI'],
  },
  {
    rule:   'Targeted-tender doctrine',
    note:   'Insured can selectively tender to one carrier; non-tendered carriers do not contribute.',
    states: ['IL','CA'],
  },
  {
    rule:   'All-sums on the back end',
    note:   'Insured may select any one triggered policy and demand full indemnification within limits.',
    states: ['OH','WA'],
  },
]

// Trust pillars
const pillars = [
  {
    icon: FileSearch,
    title: "Two layers of authority.",
    desc: "Trigger uses Hinshaw-style duty-to-defend mechanics — eight-corners, four-corners, potentiality of coverage. Priority and exhaustion use primary-case research from the controlling state's supreme court. Every section is sourced separately so you can audit each one.",
  },
  {
    icon: FileCheck,
    title: 'Citations the engine cannot invent.',
    desc: "Each state's catalog row includes a curated array of state-supreme-court citations. The COVERAGE_PRIORITY prompt is pinned to those citations and explicitly forbidden from drawing on training data. If the catalog is empty for a state, the opinion says so plainly rather than fabricate.",
  },
  {
    icon: Sparkles,
    title: 'Structural invariants, every time.',
    desc: "A deterministic post-validator confirms every policy has a trigger answer, that priority only ranks triggered policies, and that every cited authority traces back to the supplied catalog. If something doesn't reconcile, the engine retries up to three times before flagging the opinion for human review.",
  },
]

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <nav className="sticky top-0 z-50 flex items-center justify-between px-6 lg:px-16 py-4 bg-slate-950/90 backdrop-blur border-b border-white/5">
        <Link to="/" className="flex items-center gap-3">
          <img src="/logo-icon.png" alt="LexClause" className="w-11 h-11 rounded-xl ring-1 ring-white/10" />
          <div>
            <div className="font-bold text-lg leading-none font-serif-brand">LexClause</div>
            <div className="text-slate-400 text-[11px] mt-0.5 tracking-[0.18em]">COVERAGE PRIORITY</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-slate-300 hover:text-white text-sm font-medium transition-colors px-3 py-1.5">Log In</Link>
          <Link to="/register" className="flex items-center gap-1.5 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-semibold rounded-lg transition-colors">
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
          <h1 className="font-serif-brand text-5xl lg:text-7xl leading-[1.05] mb-6 tracking-tight">
            From policy stack<br />
            to coverage memo.<br />
            <span className="bg-gradient-to-r from-brand-400 to-cyan-400 bg-clip-text text-transparent">With citations that hold up.</span>
          </h1>
          <p className="text-slate-300 text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Drop your policies and the lawsuit. LexClause tells you which policies are triggered,
            in what priority order they respond, and how the tower exhausts — under the controlling state's law,
            with citations from a vetted catalog.
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
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> 30 states catalogued</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Hinshaw-grounded trigger layer</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> Citations from a vetted catalog</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> No invented case law</span>
          </div>
        </div>
      </section>

      {/* ── Three-section opinion preview ────────────────────────────────── */}
      <section className="px-6 lg:px-16 pb-8 max-w-6xl mx-auto">
        <div className="grid md:grid-cols-3 gap-4">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-700/40 to-brand-900/40 p-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand-300 font-semibold mb-1">§01</div>
            <h3 className="font-serif-brand text-2xl uppercase tracking-tight mb-2">Trigger</h3>
            <p className="text-slate-300 text-sm leading-relaxed">Every policy gets an answer — triggered, partial, or no — under the state's duty-to-defend test, with the specific allegation and coverage grant or exclusion that drove it.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-700/40 to-brand-900/40 p-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand-300 font-semibold mb-1">§02</div>
            <h3 className="font-serif-brand text-2xl uppercase tracking-tight mb-2">Priority</h3>
            <p className="text-slate-300 text-sm leading-relaxed">Among triggered policies, who is primary, co-primary, excess, or sub-excess? Other Insurance clauses compared verbatim, mutually-repugnant groups flagged, state tiebreaker applied.</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-brand-700/40 to-brand-900/40 p-6">
            <div className="text-[11px] uppercase tracking-[0.2em] text-brand-300 font-semibold mb-1">§03</div>
            <h3 className="font-serif-brand text-2xl uppercase tracking-tight mb-2">Exhaustion</h3>
            <p className="text-slate-300 text-sm leading-relaxed">Vertical, horizontal, or mixed — labelled for the governing state with the controlling citation. So you know which excess attaches when.</p>
          </div>
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif-brand text-4xl uppercase tracking-tight mb-3">How it works</h2>
          <p className="text-slate-400">Three steps from PDFs to a defensible opinion.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <div key={s.num} className="bg-white/5 border border-white/10 rounded-2xl p-6">
              <div className="text-brand-400 font-bold text-sm mb-3 tracking-[0.18em]">{s.num}</div>
              <h3 className="font-semibold text-lg mb-2">{s.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif-brand text-4xl uppercase tracking-tight mb-3">Built for the hard parts</h2>
          <p className="text-slate-400">The threshold questions coverage attorneys actually fight about.</p>
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
          <h2 className="font-serif-brand text-4xl uppercase tracking-tight mb-3">A coded catalog of state coverage law</h2>
          <p className="text-slate-400 max-w-2xl mx-auto">
            Thirty jurisdictions seeded with vetted state-supreme-court citations. The engine looks up the rule and pulls the cite — it doesn't make either up.
          </p>
        </div>
        <div className="space-y-3 max-w-4xl mx-auto">
          {doctrineCatalog.map((d) => (
            <div key={d.rule} className="flex flex-col sm:flex-row items-start gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl">
              <div className="min-w-[200px]">
                <div className="text-brand-400 font-mono text-xs uppercase tracking-wider whitespace-nowrap">
                  {d.rule}
                </div>
                <div className="text-slate-500 text-[11px] mt-1 leading-snug">{d.note}</div>
              </div>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {d.states.map(s => (
                  <span key={s} className="inline-flex items-center justify-center w-9 h-7 bg-slate-800 border border-white/10 rounded text-[11px] font-mono font-medium text-slate-200">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-slate-500 mt-6 max-w-3xl mx-auto leading-relaxed">
          Anchor cases include <span className="text-slate-300">Montrose I &amp; II</span>, <span className="text-slate-300">Consol. Edison</span>, <span className="text-slate-300">Viking Pump</span>, <span className="text-slate-300">GuideOne v. Fielder Rd.</span>, <span className="text-slate-300">Mid-Continent v. Liberty Mutual</span>, <span className="text-slate-300">John Burns / Kajima</span>, <span className="text-slate-300">Owens-Illinois</span>, <span className="text-slate-300">Boston Gas</span>, <span className="text-slate-300">J.H. France Refractories</span>, <span className="text-slate-300">Goodyear v. Aetna</span>, <span className="text-slate-300">B&amp;L Trucking</span>, <span className="text-slate-300">Wallis &amp; Companies</span>, <span className="text-slate-300">Hercules</span>, <span className="text-slate-300">Lloyd Mitchell</span>, <span className="text-slate-300">Cole v. Celotex</span>, <span className="text-slate-300">Plastics Engineering</span>, <span className="text-slate-300">Lamb-Weston</span>.
        </p>
      </section>

      {/* ── Trust pillars ────────────────────────────────────────────────── */}
      <section className="px-6 lg:px-16 py-20 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <h2 className="font-serif-brand text-4xl uppercase tracking-tight mb-3">Why the output is defensible</h2>
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
          <h2 className="font-serif-brand text-3xl lg:text-4xl uppercase tracking-tight mb-4">Stop reading four policies and a complaint to figure out who defends.</h2>
          <p className="text-slate-300 mb-8">
            Drop them in. LexClause produces a Trigger / Priority / Exhaustion opinion under the controlling state's law in under five minutes — with citations.
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
          <div>Coverage priority, made defensible</div>
        </div>
      </footer>
    </div>
  )
}
