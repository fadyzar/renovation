// Landing.tsx
import React, { useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Search,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
  Star,
  Users,
  Hammer,
  BadgeCheck,
  Wallet,
  Clock,
  MapPin,
  Phone,
  Mail,
  ChevronDown,
} from "lucide-react";
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { AuthModal } from "./auth/AuthModal";

/**
 * Drop-in Landing page (Tailwind + Framer Motion)
 * - Sticky glass navbar
 * - Hero with soft gradient background + parallax blobs
 * - Feature cards + "How it works" timeline
 * - "Kickstart" form section (project type + budget)
 * - Testimonials + FAQ accordion
 * - Newsletter + footer
 *
 * Notes:
 * - Replace brand name / logo with yours
 * - Replace image URLs with real assets (or keep the gradients)
 */

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const item = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" } },
};

function SectionHeader(props: { eyebrow?: string; title: string; subtitle?: string }) {
  const { eyebrow, title, subtitle } = props;
  return (
    <motion.div variants={item} className="text-center max-w-3xl mx-auto">
      {eyebrow ? (
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-50 text-blue-700 border border-blue-100 mb-6">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-medium">{eyebrow}</span>
        </div>
      ) : null}
      <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 tracking-tight">{title}</h2>
      {subtitle ? (
        <p className="mt-4 text-base sm:text-lg text-slate-600 leading-relaxed">{subtitle}</p>
      ) : null}
    </motion.div>
  );
}

function BadgePill({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/70 border border-slate-200 backdrop-blur">
      <span className="text-slate-700">{icon}</span>
      <span className="text-sm font-medium text-slate-700">{text}</span>
    </div>
  );
}

function FAQItem({
  q,
  a,
  open,
  onToggle,
}: {
  q: string;
  a: string;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 backdrop-blur-sm overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
      >
        <span className="font-semibold text-slate-900">{q}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-slate-600 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="px-5"
      >
        <div className="pb-5 text-slate-600 leading-relaxed">{a}</div>
      </motion.div>
    </div>
  );
}

export function Landing() {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<"owner" | "contractor">("owner");

  const [projectType, setProjectType] = useState("");
  const [budget, setBudget] = useState("");
  const [faqOpen, setFaqOpen] = useState(0);

  const reduceMotion = useReducedMotion();

  // subtle hero parallax
  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  const blobY = useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 70]);
  const blobOpacity = useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 0.65]);

  const features = useMemo(
    () => [
      {
        icon: <Wallet className="w-6 h-6 text-orange-600" />,
        title: "Fair & Transparent Pricing",
        desc:
          "Set your max budget—contractors bid transparently so you always get the best value without surprises.",
        tint: "from-orange-50 to-white",
        ring: "ring-orange-100",
      },
      {
        icon: <BadgeCheck className="w-6 h-6 text-blue-600" />,
        title: "Verified Contractors Only",
        desc:
          "Work with licensed, vetted professionals. Ratings, reviews, and verification keep quality high.",
        tint: "from-blue-50 to-white",
        ring: "ring-blue-100",
      },
      {
        icon: <Shield className="w-6 h-6 text-emerald-600" />,
        title: "Project Tracking & Secure Payments",
        desc:
          "Milestone-based payments protect both sides. Track progress, approvals, and updates in one place.",
        tint: "from-emerald-50 to-white",
        ring: "ring-emerald-100",
      },
      {
        icon: <Search className="w-6 h-6 text-indigo-600" />,
        title: "Bidding System for Best Offers",
        desc:
          "Compare multiple offers, timelines, and portfolios. Choose the contractor that fits your needs.",
        tint: "from-indigo-50 to-white",
        ring: "ring-indigo-100",
      },
    ],
    []
  );

  const steps = useMemo(
    () => [
      {
        icon: <Hammer className="w-5 h-5" />,
        title: "Describe your project",
        desc: "Select renovation type, add details, photos, and your target budget.",
      },
      {
        icon: <Users className="w-5 h-5" />,
        title: "Receive verified bids",
        desc: "Qualified contractors compete with transparent pricing and timelines.",
      },
      {
        icon: <CheckCircle2 className="w-5 h-5" />,
        title: "Track & pay by milestones",
        desc: "Approve milestones, release payments securely, and keep full control.",
      },
    ],
    []
  );

  const testimonials = useMemo(
    () => [
      {
        name: "John Mitchell",
        role: "Licensed General Contractor",
        text:
          "This platform changed how I find clients. No more wasted time—only serious homeowners, clear scope, and fair competition.",
      },
      {
        name: "Sarah Bennett",
        role: "Homeowner",
        text:
          "The process was stress-free. I set my budget, compared bids, and stayed in control the whole time. Transparent and fast.",
      },
      {
        name: "David Rosenberg",
        role: "Home Renovation Specialist",
        text:
          "Secure milestone payments made a huge difference. Everything stays professional and organized from start to finish.",
      },
    ],
    []
  );

  const faqs = useMemo(
    () => [
      {
        q: "How does pricing work?",
        a: "You set a maximum budget. Contractors submit competitive bids based on your requirements—no hidden fees.",
      },
      {
        q: "How do I know contractors are reliable?",
        a: "We verify contractors (license/credentials where applicable) and use reviews + performance checks to maintain quality.",
      },
      {
        q: "How are payments processed and secured?",
        a: "Payments are milestone-based. Funds are protected and released only after you approve each stage of work.",
      },
      {
        q: "What happens if a contractor cancels?",
        a: "You’ll be notified immediately and can choose a replacement from existing bids. Support can help you match quickly.",
      },
    ],
    []
  );

  const openAuth = (mode: "owner" | "contractor") => {
    setAuthMode(mode);
    setShowAuthModal(true);
  };

  const onKickstart = () => {
    // optional: validate, store prefill, then open auth
    // You can persist these in localStorage or pass to the modal flow
    openAuth("owner");
  };

  return (
    <div className="min-h-screen bg-white text-slate-900">
      {/* NAV */}
      <nav className="border-b border-slate-100 bg-white/70 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-blue-600 to-indigo-500" />
                <div className="absolute inset-[1px] bg-white/10 backdrop-blur" />
                <div className="relative w-full h-full flex items-center justify-center">
                  <span className="text-white font-black tracking-tight">M</span>
                </div>
              </div>
              <div className="leading-tight">
                <div className="text-lg font-semibold">M.G.BIT</div>
                <div className="text-xs text-slate-500 -mt-0.5">Renovation Marketplace</div>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-700">
              <a href="#home" className="hover:text-slate-900 transition-colors">
                Home
              </a>
              <a href="#how" className="hover:text-slate-900 transition-colors">
                How it Works
              </a>
              <a href="#contractors" className="hover:text-slate-900 transition-colors">
                Find Contractors
              </a>
              <a href="#support" className="hover:text-slate-900 transition-colors">
                Contact & Support
              </a>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => openAuth("owner")}
                className="px-4 py-2 rounded-full border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold transition-all"
              >
                Log In
              </button>
              <button
                onClick={() => openAuth("owner")}
                className="px-4 py-2 rounded-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-all shadow-sm hover:shadow-md"
              >
                Sign Up
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <section id="home" ref={heroRef} className="relative overflow-hidden">
        {/* background */}
        <div className="absolute inset-0 bg-gradient-to-b from-white via-slate-50 to-white" />
        <motion.div
          style={{ y: blobY, opacity: blobOpacity }}
          className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[900px] rounded-full"
        >
          <div className="w-full h-full rounded-full bg-[radial-gradient(circle_at_30%_30%,rgba(59,130,246,0.25),transparent_55%),radial-gradient(circle_at_70%_40%,rgba(249,115,22,0.20),transparent_55%),radial-gradient(circle_at_50%_70%,rgba(99,102,241,0.18),transparent_55%)]" />
        </motion.div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.35 }}
            variants={container}
            className="grid lg:grid-cols-12 gap-10 items-center"
          >
            <div className="lg:col-span-7">
              <motion.div variants={item} className="flex flex-wrap gap-2 mb-6">
                <BadgePill icon={<BadgeCheck className="w-4 h-4" />} text="Verified Contractors" />
                <BadgePill icon={<Shield className="w-4 h-4" />} text="Secure Payments" />
                <BadgePill icon={<Clock className="w-4 h-4" />} text="Fast Bidding" />
              </motion.div>

              <motion.h1
                variants={item}
                className="text-4xl sm:text-6xl font-black tracking-tight text-slate-900 leading-[1.05]"
              >
                Transparent & Hassle-Free{" "}
                <span className="bg-gradient-to-r from-blue-600 via-indigo-500 to-orange-500 bg-clip-text text-transparent">
                  Renovations.
                </span>
              </motion.h1>

              <motion.p variants={item} className="mt-6 text-lg sm:text-xl text-slate-600 leading-relaxed">
                Get fair pricing, verified contractors, and full project control — all in one place.
              </motion.p>

              <motion.div variants={item} className="mt-8 flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => openAuth("owner")}
                  className="group px-7 py-4 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  Start Your Project
                  <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
                </button>
                <button
                  onClick={() => openAuth("contractor")}
                  className="px-7 py-4 rounded-full bg-white hover:bg-slate-50 text-slate-900 font-semibold border border-slate-200 transition-all flex items-center justify-center gap-2"
                >
                  Join as Contractor
                </button>
              </motion.div>

              <motion.div
                variants={item}
                className="mt-8 flex flex-wrap items-center gap-6 text-sm text-slate-600"
              >
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="font-semibold text-slate-900">4.9</span>
                  <span className="text-slate-500">Average rating</span>
                </div>
                <div className="h-4 w-px bg-slate-200 hidden sm:block" />
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span className="text-slate-500">Thousands of projects posted</span>
                </div>
              </motion.div>
            </div>

            {/* right visual */}
            <motion.div variants={item} className="lg:col-span-5">
              <div className="relative rounded-3xl border border-slate-200 bg-white/60 backdrop-blur-sm shadow-[0_20px_60px_-30px_rgba(2,6,23,0.35)] overflow-hidden">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(59,130,246,0.14),transparent_55%),radial-gradient(circle_at_80%_30%,rgba(249,115,22,0.12),transparent_55%)]" />
                <div className="relative p-6 sm:p-7">
                  <div className="flex items-center justify-between mb-6">
                    <div className="text-sm font-semibold text-slate-900">Project Snapshot</div>
                    <div className="text-xs px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                      Verified
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs text-slate-500">Type</div>
                      <div className="mt-1 font-semibold">Kitchen Remodel</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className="text-xs text-slate-500">Budget</div>
                      <div className="mt-1 font-semibold">$18,000</div>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs text-slate-500">Top Bid</div>
                          <div className="mt-1 font-semibold">$16,900</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Timeline</div>
                          <div className="mt-1 font-semibold">3–4 weeks</div>
                        </div>
                      </div>
                      <div className="mt-4 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full w-[62%] rounded-full bg-gradient-to-r from-blue-600 to-indigo-500" />
                      </div>
                      <div className="mt-2 text-xs text-slate-500">Milestones completed: 62%</div>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center">
                        <Hammer className="w-5 h-5 text-slate-700" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold">Recommended Contractor</div>
                        <div className="text-xs text-slate-500">Licensed • 4.9 rating • Nearby</div>
                      </div>
                      <div className="flex items-center gap-1 text-amber-500">
                        <Star className="w-4 h-4 fill-current" />
                        <span className="text-sm font-semibold text-slate-900">4.9</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex gap-2">
                    <button
                      onClick={() => openAuth("owner")}
                      className="flex-1 px-4 py-3 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-semibold transition-all"
                    >
                      Post Project
                    </button>
                    <button
                      onClick={() => openAuth("contractor")}
                      className="flex-1 px-4 py-3 rounded-full bg-white hover:bg-slate-50 text-slate-900 font-semibold border border-slate-200 transition-all"
                    >
                      Bid Now
                    </button>
                  </div>
                </div>
              </div>

              <p className="mt-4 text-xs text-slate-500 text-center">
                Replace this preview with a real screenshot later (or keep it as a product mock).
              </p>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={container}
          >
            <SectionHeader
              title="Powerful Features for a Smooth Renovation Process"
              subtitle="Set budget, compare bids, and manage your project end-to-end — all in one place."
            />

            <motion.div
              variants={container}
              className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5"
            >
              {features.map((f) => (
                <motion.div
                  key={f.title}
                  variants={item}
                  className={cn(
                    "group rounded-3xl border border-slate-200 bg-gradient-to-b p-6 shadow-sm hover:shadow-xl transition-all",
                    f.tint,
                    "hover:-translate-y-1"
                  )}
                >
                  <div
                    className={cn(
                      "w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-sm",
                      "ring-4",
                      f.ring
                    )}
                  >
                    {f.icon}
                  </div>
                  <h3 className="mt-4 text-lg font-bold text-slate-900">{f.title}</h3>
                  <p className="mt-2 text-sm text-slate-600 leading-relaxed">{f.desc}</p>
                  <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-900 opacity-0 group-hover:opacity-100 transition-opacity">
                    Learn more <ArrowRight className="w-4 h-4" />
                  </div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* KICKSTART FORM */}
      <section id="how" className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.25 }}
            variants={container}
            className="rounded-[32px] border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 sm:p-12 shadow-[0_18px_60px_-45px_rgba(2,6,23,0.35)]"
          >
            <SectionHeader
              title="Kickstart Your Renovation in Just a Few Clicks"
              subtitle="Choose your project type, set your budget, and get instant progress — hassle-free from the start."
            />

            <motion.div variants={item} className="mt-10">
              <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-3 items-stretch">
                <div className="flex-1 relative">
                  <label className="sr-only">Select Project Type</label>
                  <select
                    value={projectType}
                    onChange={(e) => setProjectType(e.target.value)}
                    className="w-full h-12 rounded-full bg-white border border-slate-200 px-4 pr-10 text-slate-900 outline-none focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">Select Project Type</option>
                    <option>Kitchen Remodel</option>
                    <option>Bathroom Renovation</option>
                    <option>Flooring</option>
                    <option>Painting</option>
                    <option>Full Home Renovation</option>
                    <option>Outdoor / Landscaping</option>
                  </select>
                </div>

                <div className="flex-1 relative">
                  <label className="sr-only">Enter your budget</label>
                  <input
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    placeholder="Enter Your Budget..."
                    className="w-full h-12 rounded-full bg-white border border-slate-200 px-4 text-slate-900 outline-none focus:ring-4 focus:ring-blue-100"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-semibold">
                    $
                  </div>
                </div>

                <button
                  onClick={onKickstart}
                  className="h-12 px-6 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-semibold transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                >
                  Start Your Project <ArrowRight className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  No hidden fees
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Verified pros only
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Milestone payments
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="py-16 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={container}
          >
            <SectionHeader
              eyebrow="How it Works"
              title="Simple. Transparent. Controlled."
              subtitle="From project post to final payment, everything stays clear and managed."
            />

            <motion.div variants={container} className="mt-12 grid lg:grid-cols-3 gap-6">
              {steps.map((s, idx) => (
                <motion.div
                  key={s.title}
                  variants={item}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-slate-900 text-white flex items-center justify-center">
                      {s.icon}
                    </div>
                    <div className="text-sm font-semibold text-slate-500">Step {idx + 1}</div>
                  </div>
                  <h3 className="mt-4 text-xl font-bold text-slate-900">{s.title}</h3>
                  <p className="mt-2 text-slate-600 leading-relaxed">{s.desc}</p>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="py-16 sm:py-20" id="contractors">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={container}
          >
            <SectionHeader
              title="What Our Customers Are Saying About Their Experience"
              subtitle="Real stories from homeowners and contractors — from seamless renovations to reliable, high-quality work."
            />

            <motion.div variants={container} className="mt-12 grid lg:grid-cols-3 gap-6">
              {testimonials.map((t) => (
                <motion.div
                  key={t.name}
                  variants={item}
                  className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{t.name}</div>
                      <div className="text-sm text-slate-500">{t.role}</div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-amber-500">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-current" />
                      ))}
                    </div>
                  </div>

                  <p className="mt-5 text-slate-600 leading-relaxed">{t.text}</p>

                  <div className="mt-6 text-sm text-slate-500">(5 stars)</div>
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 sm:py-20" id="support">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
            variants={container}
          >
            <SectionHeader
              title="Frequently Asked Questions"
              subtitle="Got questions? We’ve got answers. Explore the most common inquiries about pricing, contractor reliability, and more."
            />

            <motion.div variants={item} className="mt-12 grid lg:grid-cols-2 gap-5">
              {faqs.map((f, i) => (
                <FAQItem
                  key={f.q}
                  q={f.q}
                  a={f.a}
                  open={faqOpen === i}
                  onToggle={() => setFaqOpen((prev) => (prev === i ? -1 : i))}
                />
              ))}
            </motion.div>

            <motion.div variants={item} className="mt-12 rounded-3xl border border-slate-200 bg-slate-900 p-8 sm:p-10 text-white">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 text-white/80 text-sm font-semibold">
                    <Zap className="w-4 h-4" />
                    Ready to build with confidence?
                  </div>
                  <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
                    Start your renovation today.
                  </h3>
                  <p className="mt-2 text-white/70">
                    Post your project, receive verified bids, and pay securely by milestones.
                  </p>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => openAuth("owner")}
                    className="px-6 py-3 rounded-full bg-white text-slate-900 font-semibold hover:shadow-xl transition-all"
                  >
                    Get Started
                  </button>
                  <button
                    onClick={() => openAuth("contractor")}
                    className="px-6 py-3 rounded-full border border-white/25 text-white font-semibold hover:bg-white/10 transition-all"
                  >
                    Join as Pro
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* NEWSLETTER */}
      <section className="py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-[#0B1220] text-white border border-white/10 px-6 sm:px-10 py-10 flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-black">Subscribe to our Newsletter</h3>
              <p className="mt-2 text-white/70">
                Get renovation tips, industry updates, and exclusive offers.
              </p>
            </div>
            <div className="w-full lg:w-auto flex flex-col sm:flex-row gap-3">
              <input
                placeholder="Enter your email"
                className="h-12 w-full sm:w-[360px] rounded-full bg-white/10 border border-white/15 px-4 text-white placeholder:text-white/50 outline-none focus:ring-4 focus:ring-blue-500/20"
              />
              <button className="h-12 px-6 rounded-full bg-white text-slate-900 font-semibold hover:shadow-xl transition-all">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t border-slate-100 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4">
              <div className="flex items-center gap-3">
                <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500 via-blue-600 to-indigo-500" />
                  <div className="absolute inset-[1px] bg-white/10 backdrop-blur" />
                  <div className="relative w-full h-full flex items-center justify-center">
                    <span className="text-white font-black tracking-tight">M</span>
                  </div>
                </div>
                <div className="text-lg font-semibold">M.G.BIT</div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 mt-0.5 text-slate-500" />
                  <span>Woodland Hills, CA (USA)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-slate-500" />
                  <span>+1 (000) 000-0000</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-slate-500" />
                  <span>office@mgbit.com</span>
                </div>
              </div>

              <p className="mt-6 text-xs text-slate-500">
                © {new Date().getFullYear()} M.G.BIT. All rights reserved.
              </p>
            </div>

            <div className="lg:col-span-8 grid sm:grid-cols-4 gap-6 text-sm">
              <div>
                <div className="font-bold text-slate-900 mb-3">Main Pages</div>
                <div className="space-y-2 text-slate-600">
                  <a className="block hover:text-slate-900" href="#home">
                    Home
                  </a>
                  <a className="block hover:text-slate-900" href="#how">
                    How it Works
                  </a>
                  <a className="block hover:text-slate-900" href="#contractors">
                    Find Contractors
                  </a>
                  <button
                    onClick={() => openAuth("owner")}
                    className="block hover:text-slate-900 text-left"
                  >
                    My Projects
                  </button>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-3">Company</div>
                <div className="space-y-2 text-slate-600">
                  <a className="block hover:text-slate-900" href="#">
                    About Us
                  </a>
                  <a className="block hover:text-slate-900" href="#">
                    Careers
                  </a>
                  <a className="block hover:text-slate-900" href="#">
                    Press
                  </a>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-3">Support</div>
                <div className="space-y-2 text-slate-600">
                  <a className="block hover:text-slate-900" href="#">
                    Help Center
                  </a>
                  <a className="block hover:text-slate-900" href="#support">
                    FAQs
                  </a>
                  <a className="block hover:text-slate-900" href="#">
                    Contact
                  </a>
                </div>
              </div>

              <div>
                <div className="font-bold text-slate-900 mb-3">Legal</div>
                <div className="space-y-2 text-slate-600">
                  <a className="block hover:text-slate-900" href="#">
                    Terms & Conditions
                  </a>
                  <a className="block hover:text-slate-900" href="#">
                    Privacy Policy
                  </a>
                  <a className="block hover:text-slate-900" href="#">
                    Refund Policy
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* AUTH */}
      <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      {/* If you have modes in AuthModal, pass it like: <AuthModal mode={authMode} ... /> */}
    </div>
  );
}
