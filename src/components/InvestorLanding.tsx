import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  ArrowLeft,
  TrendingUp,
  ShieldCheck,
  Wallet,
  Users,
  Building2,
  Zap,
  Quote,
  Sparkles,
  Search,
  FileCheck2,
  CreditCard,
  BadgeCheck,
  Landmark,
  Cpu,
  Layers,
  Percent,
  Target,
  Rocket,
  CheckCircle2,
  Banknote,
  Globe2,
  Database,
} from "lucide-react";
import { motion, type Variants } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import logo from "../assets/logo.svg";

/* ─────────────────────────────────────────────────────────────
   Content mirrors the MGBiT Seed Investment Memorandum (May 2026).
   Real figures come from the deck. Traction metrics that are not
   yet finalized from live pilot data are marked "PLACEHOLDER" and
   surfaced visibly as "—" so Gilad can fill them before sharing.
   ───────────────────────────────────────────────────────────── */

const NAVY = "#1F263E";
const ORANGE = "#FE5F20";
const BLUE = "#1336F6";

function cn(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(" ");
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.03 } },
};
const item: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" as const } },
};

function Reveal({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2 }}
      variants={container}
      className={className}
    >
      {children}
    </motion.div>
  );
}

function Kicker({ children, tone = "orange" }: { children: React.ReactNode; tone?: "orange" | "blue" }) {
  return (
    <motion.p
      variants={item}
      className={cn(
        "text-sm font-bold uppercase tracking-widest mb-3",
        tone === "orange" ? "text-brand-orange" : "text-brand-blue"
      )}
    >
      {children}
    </motion.p>
  );
}

/* ── Deck figures ── */
const arrData = [
  { year: "Year 1", value: 6 },
  { year: "Year 2", value: 18 },
  { year: "Year 3", value: 42 },
];

const fundsData = [
  { name: "Marketing & Market Entry", value: 40 },
  { name: "Product & AI Development", value: 25 },
  { name: "Team & Hiring", value: 20 },
  { name: "Regulation & Operations", value: 15 },
];

const compareRows = [
  {
    cap: "Business model",
    tt: "Paid profiles & memberships",
    angi: "Pay-per-lead bidding",
    mg: "FinTech SaaS + transactions",
  },
  {
    cap: "Project financing",
    tt: "None — paid off-platform",
    angi: "None — no protection",
    mg: "Escrow in regulated FBO accounts",
  },
  {
    cap: "Trust & verification",
    tt: "Imported third-party reviews",
    angi: "Open to fake / paid profiles",
    mg: "AI scoring + verified credentials",
  },
  {
    cap: "Incentive alignment",
    tt: "Earns regardless of outcome",
    angi: "Profits from lead failures",
    mg: "Earns only when projects succeed",
  },
];

export function InvestorLanding() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white text-brand-navy antialiased overflow-x-hidden">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#EDEDED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3">
              <img src={logo} alt="M.G.BIT" className="h-5 w-auto" />
              <span className="hidden sm:inline text-xs font-semibold tracking-widest uppercase text-brand-navy/40">
                Investor Relations
              </span>
            </button>
            <div className="flex items-center gap-2 sm:gap-4">
              <button
                onClick={() => navigate("/")}
                className="hidden sm:flex items-center gap-2 px-4 py-2.5 rounded-full text-brand-navy/70 font-semibold hover:bg-slate-50 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to site
              </button>
              <a
                href="#invest"
                className="px-5 sm:px-6 py-2.5 rounded-full bg-brand-navy hover:bg-[#161c30] text-white font-bold transition-all shadow-md active:scale-95"
              >
                The Seed Round
              </a>
            </div>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(1200px 600px at 50% -10%, rgba(19,54,246,0.10), transparent 60%), radial-gradient(900px 500px at 90% 10%, rgba(254,95,32,0.10), transparent 55%)",
          }}
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 sm:pt-20 pb-16 sm:pb-24 text-center">
          <Reveal className="flex flex-col items-center">
            <motion.div
              variants={item}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-navy/5 border border-brand-navy/10 text-sm font-semibold text-brand-navy/70 mb-8"
            >
              <Sparkles className="w-4 h-4 text-brand-orange" />
              Seed Investment Memorandum · Confidential
            </motion.div>

            <motion.h1
              variants={item}
              className="text-[2.5rem] sm:text-6xl md:text-7xl lg:text-[80px] font-extrabold tracking-[-0.03em] leading-[1.06] max-w-5xl"
            >
              The financial{" "}
              <span className="text-brand-orange">operating system</span>{" "}
              for construction.
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-8 text-lg sm:text-2xl text-brand-navy/55 max-w-3xl leading-relaxed"
            >
              MGBiT unites financing, project management, and trust in a single platform —
              owning the entire transaction from first contact to final payment.
            </motion.p>

            <motion.div variants={item} className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <a
                href="#invest"
                className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-base sm:text-lg transition-all shadow-[0_8px_30px_rgb(254,95,32,0.3)] flex items-center justify-center gap-2 active:scale-95"
              >
                See the $3M Seed Round
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#solution"
                className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-white hover:bg-slate-50 text-brand-navy font-bold text-base sm:text-lg border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                How it works
              </a>
            </motion.div>

            {/* Stat row */}
            <motion.div
              variants={item}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl"
            >
              {[
                { k: "$600B", v: "U.S. home-services & construction (TAM)", icon: Globe2 },
                { k: "10%", v: "Take-rate captured at Milestone 1", icon: Percent },
                { k: "120+", v: "Contractors committed pre-launch", icon: Users },
                { k: "$3M", v: "Seed round · California · May 2026", icon: Rocket },
              ].map((s) => (
                <div
                  key={s.v}
                  className="rounded-2xl border border-[#ECECEC] bg-white/70 backdrop-blur p-5 text-left shadow-[0_1px_0_rgba(0,0,0,0.02)]"
                >
                  <s.icon className="w-5 h-5 text-brand-blue mb-3" />
                  <div className="text-2xl sm:text-3xl font-extrabold tracking-tight">{s.k}</div>
                  <div className="text-sm text-brand-navy/50 mt-1 leading-snug">{s.v}</div>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── 01 PROBLEM ── */}
      <section className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker>01 · The Problem</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              A $600B market still runs on broken trust.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-brand-navy/55 max-w-3xl">
              U.S. home services and construction is one of the largest, most fragmented sectors in the
              economy — yet it still operates without financing, price transparency, or accountability.
            </motion.p>

            <motion.div variants={item} className="mt-12 grid sm:grid-cols-3 gap-6">
              {[
                { k: "$4,200", v: "Average loss per household from failed, disputed, or abandoned projects" },
                { k: "67%", v: "Trust-deficit index — homeowners reporting fraud, disputes, or abandonment" },
                { k: "$5B", v: "Lost annually in direct losses from failed engagements after payment" },
              ].map((s) => (
                <div key={s.k} className="rounded-2xl bg-white border border-[#ECECEC] p-7">
                  <div className="text-4xl font-extrabold text-red-500 tracking-tight">{s.k}</div>
                  <p className="mt-3 text-brand-navy/60 leading-relaxed">{s.v}</p>
                </div>
              ))}
            </motion.div>

            <motion.div variants={item} className="mt-8 grid md:grid-cols-2 gap-4">
              {[
                "Contractors lose 20–40% of project value buying leads — with no guaranteed work.",
                "Homeowners can't verify contractor reliability or fair-market pricing.",
                "No milestone payment security — both sides transact without protection.",
                "Most projects move off-platform, eliminating transparency and control.",
              ].map((t, i) => (
                <div key={i} className="flex gap-4 rounded-xl bg-white border border-[#ECECEC] p-5">
                  <div className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center font-bold shrink-0 text-sm">
                    {i + 1}
                  </div>
                  <p className="text-brand-navy/70 leading-relaxed">{t}</p>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── 02 SOLUTION ── */}
      <section id="solution" className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker tone="blue">02 · The Solution</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              One platform. From first contact to final payment.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-brand-navy/55 max-w-3xl">
              MGBiT is the first digital-native platform combining AI-driven pricing, secured escrow
              financing, and a verified trust layer into a single managed pipeline.
            </motion.p>

            <motion.div variants={item} className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { icon: Cpu, t: "AI Scope & Pricing", d: "Instant, data-backed cost estimates generated before any bid opens — fair-market clarity upfront." },
                { icon: Landmark, t: "Escrow Financing", d: "Funds held in regulated FBO accounts and released only against verified milestones." },
                { icon: ShieldCheck, t: "Verified Trust Layer", d: "AI-scored, credentialed contractors — built from verified buyers, not purchasable reviews." },
                { icon: Layers, t: "End-to-End Management", d: "Quote, milestones, approvals, and automated payouts — all tracked digitally in one workflow." },
              ].map((s) => (
                <div key={s.t} className="rounded-2xl border border-[#ECECEC] p-7 bg-gradient-to-b from-white to-[#FBFBFC]">
                  <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center mb-5">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-brand-navy/55 leading-relaxed text-[15px]">{s.d}</p>
                </div>
              ))}
            </motion.div>

            {/* Flow strip */}
            <motion.div variants={item} className="mt-10 rounded-2xl border border-[#ECECEC] bg-[#FAFAFB] p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3 justify-center text-sm sm:text-[15px] font-semibold text-brand-navy/70">
                {[
                  "Post project",
                  "AI validates scope & price",
                  "Matched bids",
                  "Escrow funded",
                  "Milestone approvals",
                  "Automatic payout",
                ].map((step, i, arr) => (
                  <span key={step} className="flex items-center gap-3">
                    <span className="px-3 py-1.5 rounded-lg bg-white border border-[#ECECEC]">{step}</span>
                    {i < arr.length - 1 && <ArrowRight className="w-4 h-4 text-brand-orange" />}
                  </span>
                ))}
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY NOW (added) ── */}
      <section className="py-20 sm:py-28 bg-brand-navy text-white relative overflow-hidden">
        <div
          className="absolute inset-0 -z-0 opacity-40"
          style={{ background: "radial-gradient(800px 400px at 15% 0%, rgba(19,54,246,0.35), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(254,95,32,0.25), transparent 55%)" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-orange mb-3">
              Why now
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-4xl">
              The Stripe + Salesforce + Uber of construction transactions.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-white/60 max-w-3xl">
              For the first time, the infrastructure to run construction as a managed financial
              transaction exists — and the market is ready for it.
            </motion.p>

            <motion.div variants={item} className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                { icon: Cpu, t: "AI pricing is here", d: "Data-backed scope and cost estimation is finally accurate enough to anchor fair-market bids." },
                { icon: Banknote, t: "Embedded finance", d: "Payments and financing can now be built directly into the transaction flow." },
                { icon: Landmark, t: "Digital escrow & open banking", d: "Regulated FBO accounts and account-to-account rails make milestone escrow practical at scale." },
                { icon: TrendingUp, t: "Rising renovation prices", d: "Higher project values raise the stakes — and the demand for transparency and protection." },
                { icon: ShieldCheck, t: "Trust has become the bottleneck", d: "As spend grows, fraud and disputes make verified trust the deciding factor in every project." },
                { icon: Target, t: "No integrated incumbent", d: "Legacy players sell leads or memberships — none own the financed, verified transaction." },
              ].map((w) => (
                <div key={w.t} className="rounded-2xl bg-white/[0.06] border border-white/10 p-6 backdrop-blur">
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center mb-4">
                    <w.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg">{w.t}</h3>
                  <p className="mt-1.5 text-white/55 text-sm leading-relaxed">{w.d}</p>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── 03 DIFFERENTIATION & MOAT ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker tone="blue">03 · Differentiation & Moat</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              We don't sell leads. We own the transaction.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-brand-navy/55 max-w-3xl">
              Incumbents profit from selling access. MGBiT shifts from lead sales to transaction
              ownership — building defensibility competitors cannot easily replicate.
            </motion.p>

            {/* Comparison table */}
            <motion.div variants={item} className="mt-12 overflow-x-auto rounded-2xl border border-[#ECECEC]">
              <table className="w-full min-w-[720px] text-left border-collapse">
                <thead>
                  <tr className="bg-[#FAFAFB] text-sm">
                    <th className="p-5 font-semibold text-brand-navy/50">Capability</th>
                    <th className="p-5 font-semibold text-brand-navy/50">Thumbtack / Houzz</th>
                    <th className="p-5 font-semibold text-brand-navy/50">Angi / HomeAdvisor</th>
                    <th className="p-5 font-bold text-brand-navy bg-brand-orange/5 border-l border-brand-orange/20">MGBiT</th>
                  </tr>
                </thead>
                <tbody>
                  {compareRows.map((r) => (
                    <tr key={r.cap} className="border-t border-[#ECECEC] text-[15px] align-top">
                      <td className="p-5 font-semibold">{r.cap}</td>
                      <td className="p-5 text-brand-navy/55">{r.tt}</td>
                      <td className="p-5 text-brand-navy/55">{r.angi}</td>
                      <td className="p-5 font-semibold text-brand-navy bg-brand-orange/5 border-l border-brand-orange/20">
                        <span className="inline-flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-brand-orange mt-0.5 shrink-0" />
                          {r.mg}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </motion.div>

            <motion.div variants={item} className="mt-8 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { icon: Zap, t: "No lead selling" },
                { icon: Landmark, t: "Regulated escrow barrier" },
                { icon: ShieldCheck, t: "Manipulation-proof reputation" },
                { icon: Database, t: "Proprietary data engine" },
              ].map((m) => (
                <div key={m.t} className="flex items-center gap-3 rounded-xl border border-[#ECECEC] p-5">
                  <div className="w-9 h-9 rounded-lg bg-brand-navy text-white flex items-center justify-center shrink-0">
                    <m.icon className="w-4.5 h-4.5" />
                  </div>
                  <span className="font-semibold text-[15px]">{m.t}</span>
                </div>
              ))}
            </motion.div>
            <motion.p variants={item} className="mt-4 text-sm text-brand-navy/40">
              The moat compounds with every project.
            </motion.p>
          </Reveal>
        </div>
      </section>

      {/* ── 04 MARKET ── */}
      <section className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker>04 · Market Size & Growth</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              A massive market, captured one region at a time.
            </motion.h2>

            <div className="mt-12 grid lg:grid-cols-5 gap-8 items-center">
              {/* TAM / SAM / SOM */}
              <motion.div variants={item} className="lg:col-span-2 space-y-4">
                {[
                  { label: "TAM", v: "$600B", d: "Total U.S. home-services & construction market", w: "100%", c: NAVY },
                  { label: "SAM", v: "$180B", d: "Segment shifting to digital platforms & marketplaces", w: "58%", c: BLUE },
                  { label: "SOM", v: "$8B", d: "Initial target market — California", w: "24%", c: ORANGE },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl border border-[#ECECEC] bg-white p-5">
                    <div className="flex items-baseline justify-between">
                      <span className="text-xs font-bold tracking-widest text-brand-navy/40">{m.label}</span>
                      <span className="text-2xl font-extrabold" style={{ color: m.c }}>{m.v}</span>
                    </div>
                    <p className="text-sm text-brand-navy/55 mt-1">{m.d}</p>
                    <div className="mt-3 h-1.5 rounded-full bg-[#F0F0F3] overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: m.w, background: m.c }} />
                    </div>
                  </div>
                ))}
              </motion.div>

              {/* ARR chart */}
              <motion.div variants={item} className="lg:col-span-3 rounded-2xl border border-[#ECECEC] bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">Projected ARR — 3-year outlook</h3>
                  <span className="text-xs font-semibold text-brand-navy/40">$ Millions</span>
                </div>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={arrData} margin={{ top: 24, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#EFEFF2" vertical={false} />
                      <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 13 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 12 }} width={44} />
                      <Tooltip
                        cursor={{ fill: "rgba(254,95,32,0.06)" }}
                        contentStyle={{ borderRadius: 12, border: "1px solid #ECECEC", fontSize: 13 }}
                        formatter={(v: number) => [`$${v}M`, "ARR"]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: "top", fill: NAVY, fontSize: 13, fontWeight: 700, formatter: (v: number) => `$${v}M` }}>
                        {arrData.map((_, i) => (
                          <Cell key={i} fill={i === arrData.length - 1 ? ORANGE : "#F0C9B8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>

            <motion.div variants={item} className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 justify-between rounded-2xl border border-[#ECECEC] bg-white p-6">
              <div className="flex items-center gap-3 flex-wrap text-sm font-semibold text-brand-navy/70">
                <span className="text-brand-navy/40 uppercase tracking-widest text-xs">Expansion</span>
                {["California", "Nevada", "Arizona", "Texas", "National"].map((s, i, a) => (
                  <span key={s} className="flex items-center gap-3">
                    <span>{s}</span>
                    {i < a.length - 1 && <ArrowRight className="w-4 h-4 text-brand-orange" />}
                  </span>
                ))}
              </div>
              <div className="text-sm font-semibold text-brand-navy/60">
                <span className="text-brand-orange font-extrabold">120+</span> contractors already committed pre-launch
              </div>
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── 05 REVENUE MODEL ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker>05 · Revenue Model</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              We capture revenue the moment a project begins.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-brand-navy/55 max-w-3xl">
              Unlike platforms that wait for an exit, MGBiT collects its take-rate directly from the
              homeowner's first milestone deposit — no intermediary, no waiting for completion.
            </motion.p>

            <div className="mt-12 grid lg:grid-cols-2 gap-8 items-stretch">
              {/* Milestone 1 capture */}
              <motion.div variants={item} className="rounded-2xl border border-[#ECECEC] bg-white p-8">
                <div className="text-xs font-bold uppercase tracking-widest text-brand-navy/40">Homeowner funds Milestone 1</div>
                <div className="mt-4 flex items-center gap-4">
                  <div className="text-6xl font-extrabold text-brand-orange tracking-tight">10%</div>
                  <div className="text-brand-navy/60 leading-snug">
                    captured instantly — MGBiT take-rate,<br className="hidden sm:block" /> direct, no middleman
                  </div>
                </div>
                {/* split bar */}
                <div className="mt-8">
                  <div className="flex h-4 rounded-full overflow-hidden">
                    <div className="bg-brand-orange" style={{ width: "10%" }} />
                    <div className="bg-brand-blue/15" style={{ width: "90%" }} />
                  </div>
                  <div className="mt-3 flex justify-between text-sm">
                    <span className="font-semibold text-brand-orange">10% captured</span>
                    <span className="font-semibold text-brand-navy/60">90% held in escrow (FBO)</span>
                  </div>
                </div>
                <div className="mt-8 flex items-start gap-3 text-sm text-brand-navy/60">
                  <ShieldCheck className="w-5 h-5 text-brand-blue shrink-0" />
                  90% held safely in a regulated FBO account and released to the contractor only on
                  verified milestones — revenue recognized early, giving immediate cash flow.
                </div>
              </motion.div>

              {/* Revenue layers */}
              <motion.div variants={item} className="space-y-4">
                {[
                  { y: "Year 1 — Operations", d: "Transaction fees on every project.", items: ["Transaction fees"], icon: CreditCard },
                  { y: "Year 2 — SaaS Layer", d: "Add contractor subscriptions on top of transactions.", items: ["Transaction fees", "Contractor SaaS subscriptions"], icon: Layers },
                  { y: "Year 3 — Ecosystem", d: "Monetize the proprietary data engine.", items: ["Transaction fees", "SaaS subscriptions", "Data & API licensing"], icon: Database },
                ].map((l) => (
                  <div key={l.y} className="rounded-2xl border border-[#ECECEC] bg-white p-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                        <l.icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="font-bold">{l.y}</div>
                        <div className="text-sm text-brand-navy/50">{l.d}</div>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {l.items.map((it) => (
                        <span key={it} className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FAFAFB] border border-[#ECECEC] text-brand-navy/70">
                          {it}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <p className="text-sm text-brand-navy/50 px-1">
                  A recurring SaaS layer at scale supports premium <span className="font-semibold text-brand-navy">10–15× SaaS multiples</span>, materially increasing valuation and investor returns.
                </p>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── TRACTION (added) ── */}
      <section className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker>Traction</Kicker>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              The engine is already running.
            </motion.h2>
            <motion.p variants={item} className="mt-5 text-lg text-brand-navy/55 max-w-3xl">
              This isn't a concept deck — the platform is live and the first transactions are flowing.
            </motion.p>

            {/* Qualitative milestones */}
            <motion.div variants={item} className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                { t: "Live platform", d: "Product built and in production." },
                { t: "Contractors onboarded", d: "120+ committed pre-launch." },
                { t: "First paying jobs", d: "Real projects completed on-platform." },
                { t: "First escrow transaction", d: "FBO milestone flow proven end-to-end." },
              ].map((m) => (
                <div key={m.t} className="rounded-2xl bg-white border border-[#ECECEC] p-6">
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mb-4" />
                  <h3 className="font-bold">{m.t}</h3>
                  <p className="mt-1 text-sm text-brand-navy/55">{m.d}</p>
                </div>
              ))}
            </motion.div>

            {/* Quantitative metrics — PLACEHOLDER: fill from live pilot data */}
            <motion.div variants={item} className="mt-6 grid sm:grid-cols-3 gap-4">
              {[
                { k: "—", v: "Customer acquisition cost (CAC)" },
                { k: "—", v: "Bid acceptance rate" },
                { k: "—", v: "Average project value" },
              ].map((s) => (
                <div key={s.v} className="rounded-2xl border border-dashed border-[#D6D6DB] bg-white p-6 text-center">
                  <div className="text-4xl font-extrabold text-brand-navy/30 tracking-tight">{s.k}</div>
                  <div className="text-sm text-brand-navy/50 mt-2">{s.v}</div>
                </div>
              ))}
            </motion.div>
            <motion.p variants={item} className="mt-4 text-sm text-brand-navy/40">
              Metrics shown as “—” are being finalized from live pilot data before this memorandum is shared.
            </motion.p>
          </Reveal>
        </div>
      </section>

      {/* ── FOUNDER (added) ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker tone="blue">Founder</Kicker>
            <div className="mt-4 grid md:grid-cols-[auto,1fr] gap-8 md:gap-12 items-start">
              <motion.div variants={item} className="flex md:flex-col items-center md:items-start gap-4">
                <div className="w-24 h-24 rounded-2xl bg-brand-navy text-white flex items-center justify-center text-3xl font-extrabold shrink-0">
                  GB
                </div>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight">Gilad BenArosh</div>
                  <div className="text-brand-navy/50 font-semibold">Founder &amp; CEO, MGBiT</div>
                </div>
              </motion.div>

              <motion.div variants={item}>
                <Quote className="w-9 h-9 text-brand-orange/40" />
                <blockquote className="mt-4 text-2xl sm:text-[28px] font-bold tracking-tight leading-[1.3]">
                  "After managing hundreds of projects and witnessing billions lost to inefficiency,
                  fraud, and lead-generation abuse, I spent years designing a new transaction
                  infrastructure for construction — from the inside."
                </blockquote>
                <div className="mt-8 grid sm:grid-cols-2 gap-3">
                  {[
                    { icon: Building2, t: "17+ years General Contractor" },
                    { icon: BadgeCheck, t: "Hundreds of completed projects" },
                    { icon: Search, t: "Lived every failure of today's construction marketplaces" },
                    { icon: Rocket, t: "Built MGBiT from inside the industry" },
                  ].map((f) => (
                    <div key={f.t} className="flex items-center gap-3 rounded-xl border border-[#ECECEC] p-4">
                      <div className="w-9 h-9 rounded-lg bg-brand-orange/10 text-brand-orange flex items-center justify-center shrink-0">
                        <f.icon className="w-4.5 h-4.5" />
                      </div>
                      <span className="text-[15px] font-semibold">{f.t}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-6 text-brand-navy/55">
                  Investors back the founder first, and the product second — MGBiT is built by an
                  operator who has lived the problem for two decades.
                </p>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── 06 THE INVESTMENT ── */}
      <section id="invest" className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <Kicker>06 · The Investment</Kicker>
            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <motion.div variants={item}>
                <div className="text-6xl sm:text-7xl font-extrabold tracking-tight">$3,000,000</div>
                <div className="mt-2 text-lg font-bold text-brand-orange uppercase tracking-widest">Seed Round</div>
                <p className="mt-6 text-lg text-brand-navy/60 leading-relaxed max-w-xl">
                  Lean operating capital to launch California, build product-market fit, and reach a
                  $6M ARR milestone — positioned for a <span className="font-bold text-brand-navy">10× step-up into Series A</span>.
                </p>

                <div className="mt-8 space-y-3">
                  {[
                    { icon: Wallet, t: "Early, recurring revenue", d: "Take-rate recognized upfront, with a clear SaaS re-rating path to premium multiples." },
                    { icon: ShieldCheck, t: "Defensible moat", d: "Regulated escrow infrastructure plus a proprietary data engine that compounds with every project." },
                    { icon: Building2, t: "Operator advantage", d: "Built by a founder who managed hundreds of projects and lived the industry's failures." },
                  ].map((r) => (
                    <div key={r.t} className="flex gap-3">
                      <div className="w-9 h-9 rounded-lg bg-brand-blue/10 text-brand-blue flex items-center justify-center shrink-0">
                        <r.icon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <div className="font-semibold">{r.t}</div>
                        <div className="text-sm text-brand-navy/55">{r.d}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Use of funds + milestones */}
              <motion.div variants={item} className="space-y-6">
                <div className="rounded-2xl border border-[#ECECEC] bg-white p-6">
                  <h3 className="font-bold mb-5">Use of funds</h3>
                  <div className="space-y-4">
                    {fundsData.map((f) => (
                      <div key={f.name}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-semibold text-brand-navy/80">{f.name}</span>
                          <span className="font-extrabold">{f.value}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-[#F0F0F3] overflow-hidden">
                          <div className="h-full rounded-full bg-brand-blue" style={{ width: `${f.value}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-2xl border border-[#ECECEC] bg-white p-6">
                  <h3 className="font-bold mb-4">Milestones on this round</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      "18–24 month runway",
                      "120+ verified contractors",
                      "$10M+ GMV",
                      "10 property-management partners",
                      "Series A ready",
                    ].map((m) => (
                      <div key={m} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-brand-orange shrink-0" />
                        <span className="font-semibold text-brand-navy/75">{m}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── CTA / CONTACT ── */}
      <section id="contact" className="py-24 sm:py-32">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.div
              variants={item}
              className="relative overflow-hidden rounded-3xl bg-brand-navy text-white p-10 sm:p-16 text-center"
            >
              <div
                className="absolute inset-0 -z-0 opacity-60"
                style={{ background: "radial-gradient(600px 300px at 20% 0%, rgba(19,54,246,0.4), transparent 60%), radial-gradient(600px 300px at 100% 100%, rgba(254,95,32,0.35), transparent 55%)" }}
              />
              <div className="relative">
                <p className="text-brand-orange font-bold tracking-widest uppercase text-sm">Not a lead company</p>
                <h2 className="mt-3 text-3xl sm:text-5xl font-extrabold tracking-tight">
                  The transaction infrastructure for construction.
                </h2>
                <p className="mt-5 text-white/60 text-lg max-w-2xl mx-auto">
                  Request the full memorandum, financial model, and a walkthrough of the live product.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <a
                    href="mailto:mgbit@mgbit.io?subject=MGBiT%20Seed%20Round%20—%20Investor%20Materials"
                    className="px-8 py-4 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-lg transition-all shadow-[0_8px_30px_rgb(254,95,32,0.35)] flex items-center justify-center gap-2 active:scale-95"
                  >
                    Request the Memorandum
                    <ArrowRight className="w-5 h-5" />
                  </a>
                  <a
                    href="mailto:mgbit@mgbit.io?subject=MGBiT%20Investor%20Call"
                    className="px-8 py-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-lg transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    Book a call
                  </a>
                </div>
                <p className="mt-6 text-white/40 text-sm">mgbit@mgbit.io · 855-826-4248</p>
              </div>
            </motion.div>
            <motion.p variants={item} className="mt-8 text-center text-xs text-brand-navy/40 max-w-3xl mx-auto">
              Forward-looking statements are illustrative and not guaranteed. This document is
              confidential and intended for prospective investors only.
            </motion.p>
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#EDEDED] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={logo} alt="M.G.BIT" className="h-5 w-auto" />
          <p className="text-sm text-brand-navy/40">
            © {new Date().getFullYear()} MGBiT — My Great Building Tool · Confidential
          </p>
          <button onClick={() => navigate("/")} className="text-sm font-semibold text-brand-navy/60 hover:text-brand-navy">
            ← Back to main site
          </button>
        </div>
      </footer>
    </div>
  );
}
