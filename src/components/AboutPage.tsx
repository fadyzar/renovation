import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import {
  Shield,
  Wallet,
  BadgeCheck,
  Search,
  ClipboardList,
  MessageSquare,
  UserCheck,
  LayoutDashboard,
  CreditCard,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import logo from "../assets/logo.svg";
import { Footer } from "./Footer";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.04 } },
};

const item: Variants = {
  hidden: { opacity: 0, y: 20, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" as const } },
};

const values = [
  {
    icon: <Wallet className="w-6 h-6" />,
    title: "Transparent Pricing",
    desc: "Set your budget upfront. Contractors compete for your project, so you always get fair pricing with no hidden fees or surprises.",
    accent: "#FE5F20",
    bg: "bg-orange-50",
    border: "border-orange-200",
    iconBg: "bg-orange-100",
    iconColor: "text-brand-orange",
  },
  {
    icon: <BadgeCheck className="w-6 h-6" />,
    title: "Verified Professionals",
    desc: "Every contractor is license-verified and reviewed. You work only with trusted professionals vetted for reliability and quality.",
    accent: "#1336F6",
    bg: "bg-blue-50",
    border: "border-blue-200",
    iconBg: "bg-blue-100",
    iconColor: "text-brand-blue",
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: "Secure Milestone Payments",
    desc: "Funds are protected and released only after you approve each stage of work. Full financial control, always.",
    accent: "#00DAFF",
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    iconBg: "bg-cyan-100",
    iconColor: "text-cyan-600",
  },
  {
    icon: <Search className="w-6 h-6" />,
    title: "Competitive Bidding",
    desc: "Contractors compete for your project so you can compare offers, profiles, and timelines — then choose the best fit.",
    accent: "#1F263E",
    bg: "bg-slate-50",
    border: "border-slate-200",
    iconBg: "bg-slate-100",
    iconColor: "text-brand-navy",
  },
];

const steps = [
  { icon: <ClipboardList className="w-5 h-5" />, title: "Post Your Project", desc: "Describe your renovation, set your budget, upload photos, and specify your timeline." },
  { icon: <MessageSquare className="w-5 h-5" />, title: "Receive Contractor Bids", desc: "Qualified contractors review your project and submit competitive bids with pricing and timelines." },
  { icon: <UserCheck className="w-5 h-5" />, title: "Choose Your Contractor", desc: "Compare profiles, reviews, and bids. Select the best professional that fits your needs and budget." },
  { icon: <LayoutDashboard className="w-5 h-5" />, title: "Track Project Progress", desc: "Monitor every milestone in real time. Approve work stages and keep full visibility from start to finish." },
  { icon: <CreditCard className="w-5 h-5" />, title: "Approve & Pay Securely", desc: "Release payments only after each milestone is completed and approved. Funds are always protected." },
];

const stats = [
  { value: "10,000+", label: "Projects Completed" },
  { value: "2,500+", label: "Verified Contractors" },
  { value: "98%", label: "Client Satisfaction" },
  { value: "24–48h", label: "Average First Bid" },
];

export function AboutPage() {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const motionProps = (delay = 0) =>
    reduceMotion
      ? {}
      : { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 }, variants: container, transition: { delay } };

  return (
    <div className="min-h-screen bg-white font-sans">

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <button onClick={() => navigate("/")} className="flex items-center gap-2">
            <img src={logo} alt="M.G.BiT" className="h-8 w-auto" />
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/login")}
              className="px-5 py-2 rounded-full text-brand-navy font-semibold text-sm hover:bg-slate-50 transition-all"
            >
              Log In
            </button>
            <button
              onClick={() => navigate("/signup")}
              className="px-5 py-2 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-semibold text-sm transition-all shadow-md"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative bg-brand-navy overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full bg-brand-blue blur-[120px]" />
          <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full bg-brand-orange blur-[100px]" />
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 text-center">
          <motion.div {...motionProps()} className="space-y-6">
            <motion.span variants={item} className="inline-block px-4 py-1.5 rounded-full bg-white/10 text-white/80 text-sm font-medium tracking-wide border border-white/20">
              About M.G.BiT
            </motion.span>
            <motion.h1
              variants={item}
              className="text-4xl sm:text-5xl md:text-[72px] font-extrabold text-white leading-[1.15] tracking-tight"
            >
              Renovations Done Right,<br className="hidden md:block" /> Every Time.
            </motion.h1>
            <motion.p variants={item} className="text-lg sm:text-xl text-white/70 max-w-2xl mx-auto leading-relaxed">
              M.G.BiT is the AI-powered renovation platform connecting property owners with verified contractors — transparently, securely, and efficiently.
            </motion.p>
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center pt-2">
              <button
                onClick={() => navigate("/signup")}
                className="px-8 py-4 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-base transition-all shadow-[0_8px_30px_rgb(254,95,32,0.35)] flex items-center justify-center gap-2 active:scale-95"
              >
                Start Your Project <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/")}
                className="px-8 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-base border border-white/20 transition-all flex items-center justify-center gap-2 active:scale-95"
              >
                See How It Works
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── STATS ── */}
      <section className="bg-white border-b border-gray-100 py-14">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={container}
            className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
          >
            {stats.map((s) => (
              <motion.div key={s.label} variants={item}>
                <p className="text-3xl sm:text-4xl font-extrabold text-brand-navy">{s.value}</p>
                <p className="text-sm text-[#909090] mt-1 font-medium">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── MISSION ── */}
      <section className="py-24 bg-[#FAFAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={container}
            className="grid lg:grid-cols-2 gap-16 items-center"
          >
            <div>
              <motion.p variants={item} className="text-brand-orange font-semibold text-sm tracking-widest uppercase mb-3">Our Mission</motion.p>
              <motion.h2 variants={item} className="text-3xl sm:text-4xl md:text-[48px] font-extrabold text-brand-navy leading-[1.2] mb-6">
                Making Home Renovation<br className="hidden md:block" /> Honest and Simple
              </motion.h2>
              <motion.p variants={item} className="text-[#909090] text-lg leading-relaxed mb-5">
                We built M.G.BiT because we believe renovation shouldn't feel like a gamble. Too many homeowners overpay, get misled, or end up with unfinished work and empty wallets.
              </motion.p>
              <motion.p variants={item} className="text-[#909090] text-lg leading-relaxed mb-8">
                Our platform puts property owners back in control — with verified contractors, transparent bidding, and milestone-based payments that protect everyone involved.
              </motion.p>
              <motion.div variants={item} className="space-y-3">
                {[
                  "No hidden fees — ever",
                  "Contractors verified by license and reviews",
                  "Payments released only after your approval",
                  "Full project visibility from day one",
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <CheckCircle2 className="w-5 h-5 text-brand-orange flex-shrink-0" />
                    <span className="text-brand-navy font-medium">{point}</span>
                  </div>
                ))}
              </motion.div>
            </div>

            <motion.div variants={item} className="grid grid-cols-2 gap-4">
              <div className="bg-brand-navy rounded-2xl p-6 text-white">
                <p className="text-4xl font-extrabold text-brand-orange mb-2">24h</p>
                <p className="text-sm text-white/70 leading-relaxed">Average time to receive your first contractor bid after posting</p>
              </div>
              <div className="bg-brand-orange rounded-2xl p-6 text-white mt-6">
                <p className="text-4xl font-extrabold mb-2">100%</p>
                <p className="text-sm text-white/80 leading-relaxed">Milestone-protected payments — funds only release when you approve</p>
              </div>
              <div className="bg-brand-blue rounded-2xl p-6 text-white">
                <p className="text-4xl font-extrabold mb-2">2,500+</p>
                <p className="text-sm text-white/80 leading-relaxed">Licensed and reviewed contractors ready for your project</p>
              </div>
              <div className="bg-[#F6F7FF] border border-[#D0D6FF] rounded-2xl p-6 mt-6">
                <p className="text-4xl font-extrabold text-brand-navy mb-2">98%</p>
                <p className="text-sm text-[#909090] leading-relaxed">Client satisfaction rate across all completed projects</p>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── VALUES ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={container}
            className="text-center mb-16"
          >
            <motion.p variants={item} className="text-brand-orange font-semibold text-sm tracking-widest uppercase mb-3">What We Stand For</motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-4xl md:text-[48px] font-extrabold text-brand-navy leading-[1.25]">
              Built on Four Core Values
            </motion.h2>
            <motion.p variants={item} className="mt-4 text-lg text-[#909090] max-w-2xl mx-auto">
              Every decision we make comes back to these principles — for homeowners and contractors alike.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={container}
            className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {values.map((v) => (
              <motion.div
                key={v.title}
                variants={item}
                className={`rounded-2xl border p-6 ${v.bg} ${v.border} hover:shadow-md transition-shadow`}
              >
                <div className={`w-12 h-12 rounded-xl ${v.iconBg} flex items-center justify-center mb-4 ${v.iconColor}`}>
                  {v.icon}
                </div>
                <h3 className="text-[17px] font-bold text-brand-navy mb-2">{v.title}</h3>
                <p className="text-[14px] text-[#909090] leading-relaxed">{v.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-24 bg-[#FAFAFB]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={container}
            className="text-center mb-16"
          >
            <motion.p variants={item} className="text-brand-orange font-semibold text-sm tracking-widest uppercase mb-3">The Process</motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-4xl md:text-[48px] font-extrabold text-brand-navy leading-[1.25]">
              From Idea to Finished Project
            </motion.h2>
            <motion.p variants={item} className="mt-4 text-lg text-[#909090] max-w-2xl mx-auto">
              Simple. Transparent. Controlled. Everything stays clear and managed from start to finish.
            </motion.p>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.1 }} variants={container}
            className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6"
          >
            {steps.map((s, i) => (
              <motion.div
                key={s.title}
                variants={item}
                className="relative bg-white rounded-2xl border border-gray-200 p-6 hover:shadow-md transition-shadow group"
              >
                <div className="absolute top-5 right-5 text-5xl font-black text-slate-100 group-hover:text-brand-blue/10 transition-colors select-none">
                  {i + 1}
                </div>
                <div className="w-10 h-10 rounded-xl bg-brand-navy flex items-center justify-center text-white mb-4 relative z-10">
                  {s.icon}
                </div>
                <h3 className="text-[15px] font-bold text-brand-navy mb-2 relative z-10">{s.title}</h3>
                <p className="text-[13px] text-[#909090] leading-relaxed relative z-10">{s.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── WHO WE SERVE ── */}
      <section className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.2 }} variants={container}
            className="text-center mb-14"
          >
            <motion.p variants={item} className="text-brand-orange font-semibold text-sm tracking-widest uppercase mb-3">Who We Serve</motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-4xl md:text-[48px] font-extrabold text-brand-navy leading-[1.25]">
              Built for Both Sides
            </motion.h2>
          </motion.div>

          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.15 }} variants={container}
            className="grid md:grid-cols-2 gap-8"
          >
            <motion.div variants={item} className="rounded-2xl bg-brand-navy p-10 text-white">
              <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center mb-6">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-4">For Property Owners</h3>
              <p className="text-white/70 leading-relaxed mb-6">
                Whether it's a kitchen remodel, full home renovation, or a bathroom upgrade — post your project, receive competitive bids, and stay in control from day one.
              </p>
              <ul className="space-y-2">
                {["Post your project in minutes", "Compare bids from verified contractors", "Track every milestone", "Pay securely with full protection"].map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-white/80">
                    <CheckCircle2 className="w-4 h-4 text-brand-orange flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/signup")}
                className="mt-8 px-6 py-3 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-sm transition-all inline-flex items-center gap-2"
              >
                Post a Project <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>

            <motion.div variants={item} className="rounded-2xl bg-[#F6F7FF] border border-[#D0D6FF] p-10">
              <div className="w-12 h-12 rounded-xl bg-brand-blue/10 flex items-center justify-center mb-6">
                <BadgeCheck className="w-6 h-6 text-brand-blue" />
              </div>
              <h3 className="text-2xl font-bold text-brand-navy mb-4">For Contractors</h3>
              <p className="text-[#909090] leading-relaxed mb-6">
                Join a platform built around serious, qualified leads. No wasted time on cold outreach — only property owners ready to move forward with verified budgets.
              </p>
              <ul className="space-y-2">
                {["Browse projects that match your specialty", "Submit competitive bids", "Secure milestone payments on time", "Build your reputation with verified reviews"].map((p) => (
                  <li key={p} className="flex items-center gap-2 text-sm text-brand-navy/80">
                    <CheckCircle2 className="w-4 h-4 text-brand-blue flex-shrink-0" />
                    {p}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/signup")}
                className="mt-8 px-6 py-3 rounded-full bg-brand-navy hover:opacity-90 text-white font-bold text-sm transition-all inline-flex items-center gap-2"
              >
                Join as Contractor <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CONTACT ── */}
      <section className="py-24 bg-[#FAFAFB]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.3 }} variants={container}
          >
            <motion.p variants={item} className="text-brand-orange font-semibold text-sm tracking-widest uppercase mb-3">Get in Touch</motion.p>
            <motion.h2 variants={item} className="text-3xl sm:text-4xl font-extrabold text-brand-navy mb-4">We're Here to Help</motion.h2>
            <motion.p variants={item} className="text-[#909090] text-lg mb-12">
              Have questions? Our support team is available Monday – Friday, 6am to 8pm EST.
            </motion.p>
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-6 justify-center">
              <a href="mailto:mgbit@mgbit.io" className="flex items-center gap-3 px-6 py-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center group-hover:bg-brand-orange transition-colors">
                  <Mail className="w-5 h-5 text-brand-orange group-hover:text-white transition-colors" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-[#909090]">Email Us</p>
                  <p className="text-sm font-semibold text-brand-navy">mgbit@mgbit.io</p>
                </div>
              </a>
              <a href="tel:+18558264248" className="flex items-center gap-3 px-6 py-4 bg-white rounded-xl border border-gray-200 hover:shadow-md transition-shadow group">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center group-hover:bg-brand-blue transition-colors">
                  <Phone className="w-5 h-5 text-brand-blue group-hover:text-white transition-colors" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-[#909090]">Call Us</p>
                  <p className="text-sm font-semibold text-brand-navy">855-826-4248</p>
                </div>
              </a>
              <div className="flex items-center gap-3 px-6 py-4 bg-white rounded-xl border border-gray-200">
                <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-brand-navy" />
                </div>
                <div className="text-left">
                  <p className="text-xs text-[#909090]">Our Office</p>
                  <p className="text-sm font-semibold text-brand-navy">Woodland Hills, CA 91367</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 bg-brand-navy relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-[500px] h-[500px] rounded-full bg-brand-orange blur-[100px]" />
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-brand-blue blur-[100px]" />
        </div>
        <div className="relative max-w-3xl mx-auto px-4 text-center">
          <motion.div
            initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.4 }} variants={container}
          >
            <motion.h2 variants={item} className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-white leading-[1.2] mb-5">
              Ready to Start Your<br className="hidden sm:block" /> Renovation?
            </motion.h2>
            <motion.p variants={item} className="text-white/70 text-lg mb-8">
              Join thousands of homeowners and contractors who trust M.G.BiT to get the job done right.
            </motion.p>
            <motion.div variants={item} className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => navigate("/signup")}
                className="px-10 py-4 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-base transition-all shadow-[0_8px_30px_rgb(254,95,32,0.35)] flex items-center justify-center gap-2 active:scale-95"
              >
                Get Started Free <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate("/login")}
                className="px-10 py-4 rounded-full bg-white/10 hover:bg-white/20 text-white font-bold text-base border border-white/20 transition-all flex items-center justify-center active:scale-95"
              >
                Log In
              </button>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
