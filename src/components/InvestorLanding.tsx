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
  LineChart as LineChartIcon,
  Layers,
  Quote,
  Sparkles,
  Search,
  FileCheck2,
  CreditCard,
  BadgeCheck,
  Globe2,
} from "lucide-react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  AreaChart,
  Area,
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
   NOTE: Numbers on this page are illustrative placeholders until
   the investor deck content lands. Search "PLACEHOLDER" to update.
   ───────────────────────────────────────────────────────────── */

const NAVY = "#1F263E";
const ORANGE = "#FE5F20";
const BLUE = "#1336F6";

function cn(...c: Array<string | false | undefined | null>) {
  return c.filter(Boolean).join(" ");
}

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
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
      viewport={{ once: true, amount: 0.25 }}
      variants={container}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ── PLACEHOLDER data ── */
const marketData = [
  { year: "2021", value: 452 },
  { year: "2022", value: 486 },
  { year: "2023", value: 512 },
  { year: "2024", value: 538 },
  { year: "2025", value: 571 },
  { year: "2026", value: 610 },
  { year: "2027", value: 654 },
];

const revenueData = [
  { year: "Y1", value: 0.4 },
  { year: "Y2", value: 2.1 },
  { year: "Y3", value: 7.8 },
  { year: "Y4", value: 21 },
  { year: "Y5", value: 46 },
];

export function InvestorLanding() {
  const navigate = useNavigate();
  const reduce = useReducedMotion();

  return (
    <div className="min-h-screen bg-white text-brand-navy antialiased overflow-x-hidden">
      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-[#EDEDED]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <button onClick={() => navigate("/")} className="flex items-center gap-3">
              <img src={logo} alt="M.G.BIT" className="h-5 w-auto" />
              <span className="hidden sm:inline text-xs font-semibold tracking-widest uppercase text-brand-navy/40">
                Investors
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
                href="#contact"
                className="px-5 sm:px-6 py-2.5 rounded-full bg-brand-navy hover:bg-[#161c30] text-white font-bold transition-all shadow-md active:scale-95"
              >
                Request the Deck
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 sm:pt-24 pb-16 sm:pb-24 text-center">
          <Reveal className="flex flex-col items-center">
            <motion.div
              variants={item}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-navy/5 border border-brand-navy/10 text-sm font-semibold text-brand-navy/70 mb-8"
            >
              <Sparkles className="w-4 h-4 text-brand-orange" />
              The operating system for renovations
            </motion.div>

            <motion.h1
              variants={item}
              className="text-[2.6rem] sm:text-6xl md:text-7xl lg:text-[84px] font-extrabold tracking-[-0.03em] leading-[1.05] max-w-5xl"
            >
              We're building the{" "}
              <span className="relative whitespace-nowrap">
                <span className="relative z-10 text-brand-orange">Uber</span>
              </span>{" "}
              of the renovation industry.
            </motion.h1>

            <motion.p
              variants={item}
              className="mt-8 text-lg sm:text-2xl text-brand-navy/55 max-w-3xl leading-relaxed"
            >
              A $500B+ industry still runs on word-of-mouth, hidden pricing, and broken trust.
              MGBiT makes renovations transparent, verified, and escrow-protected — end to end.
            </motion.p>

            <motion.div variants={item} className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
              <a
                href="#contact"
                className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-base sm:text-lg transition-all shadow-[0_8px_30px_rgb(254,95,32,0.3)] flex items-center justify-center gap-2 active:scale-95"
              >
                Request the Investor Deck
                <ArrowRight className="w-5 h-5" />
              </a>
              <a
                href="#model"
                className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-white hover:bg-slate-50 text-brand-navy font-bold text-base sm:text-lg border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                See the model
              </a>
            </motion.div>

            {/* Stat row */}
            <motion.div
              variants={item}
              className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 w-full max-w-4xl"
            >
              {[
                { k: "$500B+", v: "US renovation market", icon: Globe2 },
                { k: "10%", v: "Transparent take rate", icon: Wallet },
                { k: "100%", v: "Escrow-protected funds", icon: ShieldCheck },
                { k: "~20 yrs", v: "Founder industry experience", icon: BadgeCheck },
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

      {/* ── PROBLEM ── */}
      <section className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-orange mb-3">
              The problem
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              Renovating is one of the most stressful purchases people ever make.
            </motion.h2>
            <motion.div variants={item} className="mt-14 grid md:grid-cols-3 gap-6">
              {[
                { t: "Zero price transparency", d: "Homeowners get wildly different quotes with no way to know what's fair. Overpaying is the norm." },
                { t: "Trust is broken", d: "No verification, no accountability. Horror stories of unfinished jobs and vanished deposits." },
                { t: "Money is unprotected", d: "Cash changes hands up front with no escrow, no milestones, no recourse when things go wrong." },
              ].map((p) => (
                <div key={p.t} className="rounded-2xl bg-white border border-[#ECECEC] p-7">
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center mb-5 font-bold">✕</div>
                  <h3 className="text-lg font-bold">{p.t}</h3>
                  <p className="mt-2 text-brand-navy/55 leading-relaxed">{p.d}</p>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── SOLUTION ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-blue mb-3">
              The solution
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              One platform that makes every renovation transparent and safe.
            </motion.h2>
            <motion.div variants={item} className="mt-14 grid md:grid-cols-3 gap-6">
              {[
                { icon: Search, t: "Fair, data-driven pricing", d: "Smart matching surfaces verified contractors and fair-market pricing instantly." },
                { icon: ShieldCheck, t: "Verified professionals", d: "Every contractor is vetted, licensed, and accountable through the platform." },
                { icon: Wallet, t: "Escrow & milestones", d: "Funds are held in escrow and released as milestones are approved. Everyone protected." },
              ].map((s) => (
                <div key={s.t} className="rounded-2xl border border-[#ECECEC] p-7 bg-gradient-to-b from-white to-[#FBFBFC]">
                  <div className="w-11 h-11 rounded-xl bg-brand-blue/10 text-brand-blue flex items-center justify-center mb-5">
                    <s.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">{s.t}</h3>
                  <p className="mt-2 text-brand-navy/55 leading-relaxed">{s.d}</p>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── HOW IT WORKS / FLOW ── */}
      <section className="py-20 sm:py-28 bg-brand-navy text-white relative overflow-hidden">
        <div
          className="absolute inset-0 -z-0 opacity-40"
          style={{ background: "radial-gradient(800px 400px at 15% 0%, rgba(19,54,246,0.35), transparent 60%), radial-gradient(700px 400px at 100% 100%, rgba(254,95,32,0.25), transparent 55%)" }}
        />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-orange mb-3">
              How it works
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              From "I need a renovation" to keys in hand — in one flow.
            </motion.h2>

            <motion.div variants={item} className="mt-16 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { n: "01", icon: FileCheck2, t: "Post the project", d: "Homeowner describes the job in minutes." },
                { n: "02", icon: Users, t: "Get matched", d: "Verified contractors are matched and bid transparently." },
                { n: "03", icon: CreditCard, t: "Fund in escrow", d: "Payment is secured and released by milestone." },
                { n: "04", icon: BadgeCheck, t: "Track to done", d: "Full visibility, messaging, and approvals in-app." },
              ].map((step, i) => (
                <div key={step.n} className="relative rounded-2xl bg-white/[0.06] border border-white/10 p-6 backdrop-blur">
                  <div className="text-brand-orange font-extrabold text-sm tracking-widest">{step.n}</div>
                  <div className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center my-4">
                    <step.icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-bold text-lg">{step.t}</h3>
                  <p className="mt-1.5 text-white/55 text-sm leading-relaxed">{step.d}</p>
                  {i < 3 && (
                    <ArrowRight className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 w-6 h-6 text-white/20" />
                  )}
                </div>
              ))}
            </motion.div>
            <motion.p variants={item} className="mt-8 text-white/40 text-sm">
              {/* PLACEHOLDER: replace with real product screenshots of the flow */}
              Live product screenshots of each step drop in here.
            </motion.p>
          </Reveal>
        </div>
      </section>

      {/* ── MARKET ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-blue mb-3">
              Market opportunity
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              A massive, growing market — and almost entirely offline.
            </motion.h2>

            <div className="mt-14 grid lg:grid-cols-5 gap-8 items-center">
              {/* Chart */}
              <motion.div variants={item} className="lg:col-span-3 rounded-2xl border border-[#ECECEC] p-6 bg-white">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">US home improvement market</h3>
                  <span className="text-xs font-semibold text-brand-navy/40">$ Billions · illustrative</span>
                </div>
                <div className="h-[280px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={marketData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="mkt" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={BLUE} stopOpacity={0.35} />
                          <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#EFEFF2" vertical={false} />
                      <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 12 }} width={44} />
                      <Tooltip
                        cursor={{ stroke: BLUE, strokeOpacity: 0.2 }}
                        contentStyle={{ borderRadius: 12, border: "1px solid #ECECEC", fontSize: 13 }}
                        formatter={(v: number) => [`$${v}B`, "Market"]}
                      />
                      <Area type="monotone" dataKey="value" stroke={BLUE} strokeWidth={2} fill="url(#mkt)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>

              {/* TAM / SAM / SOM */}
              <motion.div variants={item} className="lg:col-span-2 space-y-4">
                {[
                  { label: "TAM", v: "$500B+", d: "US renovation & home improvement spend", w: "100%", c: NAVY },
                  { label: "SAM", v: "$120B", d: "Managed mid-size residential projects", w: "62%", c: BLUE },
                  { label: "SOM", v: "$4B", d: "Beachhead metros, years 1–5", w: "28%", c: ORANGE },
                ].map((m) => (
                  <div key={m.label} className="rounded-2xl border border-[#ECECEC] p-5">
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
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── BUSINESS MODEL ── */}
      <section id="model" className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-orange mb-3">
              Business model
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              We make money only when the work gets done.
            </motion.h2>

            <div className="mt-14 grid lg:grid-cols-2 gap-8 items-stretch">
              <motion.div variants={item} className="rounded-2xl border border-[#ECECEC] bg-white p-8 flex flex-col justify-center">
                <div className="flex items-center gap-4">
                  <div className="text-6xl sm:text-7xl font-extrabold text-brand-orange tracking-tight">10%</div>
                  <div className="text-brand-navy/60 leading-snug">
                    transparent platform fee on <br className="hidden sm:block" />each completed project
                  </div>
                </div>
                <div className="mt-8 space-y-4">
                  {[
                    { icon: Wallet, t: "Escrow float & payments", d: "Managed funds create additional monetization surface." },
                    { icon: ShieldCheck, t: "Verification & insurance", d: "Trust products layered on top of the core marketplace." },
                    { icon: Layers, t: "Contractor SaaS & financing", d: "Tools contractors pay for — the expansion engine." },
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

              <motion.div variants={item} className="rounded-2xl border border-[#ECECEC] bg-white p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold">Projected revenue</h3>
                  <span className="text-xs font-semibold text-brand-navy/40">$ Millions · illustrative</span>
                </div>
                <div className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={revenueData} margin={{ top: 20, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke="#EFEFF2" vertical={false} />
                      <XAxis dataKey="year" tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 12 }} />
                      <YAxis tickLine={false} axisLine={false} tick={{ fill: "#9AA0AE", fontSize: 12 }} width={44} />
                      <Tooltip
                        cursor={{ fill: "rgba(254,95,32,0.06)" }}
                        contentStyle={{ borderRadius: 12, border: "1px solid #ECECEC", fontSize: 13 }}
                        formatter={(v: number) => [`$${v}M`, "Revenue"]}
                      />
                      <Bar dataKey="value" radius={[6, 6, 0, 0]} label={{ position: "top", fill: NAVY, fontSize: 12, fontWeight: 700, formatter: (v: number) => `$${v}M` }}>
                        {revenueData.map((_, i) => (
                          <Cell key={i} fill={i === revenueData.length - 1 ? ORANGE : "#F0C9B8"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── WHY NOW / MOAT ── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.p variants={item} className="text-sm font-bold uppercase tracking-widest text-brand-blue mb-3">
              Why now
            </motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-5xl font-extrabold tracking-tight max-w-3xl">
              The category leaders are lead-gen. We own the whole transaction.
            </motion.h2>
            <motion.div variants={item} className="mt-14 grid md:grid-cols-3 gap-6">
              {[
                { icon: Zap, t: "End-to-end, not leads", d: "Legacy players sell contacts and walk away. We manage matching, payments, and delivery — capturing the whole journey." },
                { icon: TrendingUp, t: "Trust is the wedge", d: "Escrow + verification solve the #1 reason renovations fail. That trust compounds into a defensible network." },
                { icon: Building2, t: "Built by an insider", d: "This isn't a tech team guessing at the industry — it's built by someone who has lived it for two decades." },
              ].map((w) => (
                <div key={w.t} className="rounded-2xl border border-[#ECECEC] p-7">
                  <div className="w-11 h-11 rounded-xl bg-brand-orange/10 text-brand-orange flex items-center justify-center mb-5">
                    <w.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold">{w.t}</h3>
                  <p className="mt-2 text-brand-navy/55 leading-relaxed">{w.d}</p>
                </div>
              ))}
            </motion.div>
          </Reveal>
        </div>
      </section>

      {/* ── FOUNDER STORY ── */}
      <section className="py-20 sm:py-28 bg-[#FAFAFB] border-y border-[#EFEFEF]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <Reveal>
            <motion.div variants={item}>
              <Quote className="w-10 h-10 text-brand-orange/40" />
            </motion.div>
            <motion.blockquote
              variants={item}
              className="mt-6 text-2xl sm:text-4xl font-bold tracking-tight leading-[1.25]"
            >
              "I've spent almost 20 years in this industry. I saw every problem from the
              inside — the overpaying, the broken trust, the money that disappears. I built
              MGBiT because I was done with the old way."
            </motion.blockquote>
            <motion.div variants={item} className="mt-8 flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold">
                MG
              </div>
              <div>
                {/* PLACEHOLDER: founder name & title */}
                <div className="font-bold">Founder &amp; CEO</div>
                <div className="text-sm text-brand-navy/50">MGBiT · ~20 years in renovation</div>
              </div>
            </motion.div>
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
                <LineChartIcon className="w-10 h-10 mx-auto text-brand-orange mb-6" />
                <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight">
                  Let's build the future of renovations together.
                </h2>
                <p className="mt-5 text-white/60 text-lg max-w-2xl mx-auto">
                  Request the full investor deck, financial model, and a walkthrough of the live product.
                </p>
                <div className="mt-9 flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                  <a
                    href="mailto:mgbit@mgbit.io?subject=MGBiT%20Investor%20Deck%20Request"
                    className="px-8 py-4 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-lg transition-all shadow-[0_8px_30px_rgb(254,95,32,0.35)] flex items-center justify-center gap-2 active:scale-95"
                  >
                    Request the Deck
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
          </Reveal>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="border-t border-[#EDEDED] py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <img src={logo} alt="M.G.BIT" className="h-5 w-auto" />
          <p className="text-sm text-brand-navy/40">
            © {new Date().getFullYear()} MGBiT · Confidential — for prospective investors only
          </p>
          <button onClick={() => navigate("/")} className={cn("text-sm font-semibold text-brand-navy/60 hover:text-brand-navy", reduce && "")}>
            ← Back to main site
          </button>
        </div>
      </footer>
    </div>
  );
}
