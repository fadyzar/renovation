import { useMemo, useRef, useState } from "react";
import {
  Search,
  Shield,
  ArrowRight,
  Star,
  BadgeCheck,
  Wallet,
  ChevronDown,
  CheckCircle2,
  ClipboardList,
  MessageSquare,
  UserCheck,
  LayoutDashboard,
  CreditCard,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion, useScroll, useTransform, type Variants } from "framer-motion";
import landingPage from '../assets/landingPage.svg';
import backgroundLandingPAge from '../assets/backgroundLandingPAge.svg';
import logo from '../assets/logo.svg';
import { Footer } from './Footer';

function cn(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(" ");
}

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.08, delayChildren: 0.04 },
  },
};

const item: Variants = {
  hidden: { opacity: 0, y: 16, filter: "blur(6px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: "easeOut" as const } },
};

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
    <div className="rounded-[16px] border border-[#CFCFCF] bg-white">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="font-semibold text-brand-navy text-[17px]">{q}</span>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-[#909090] transition-transform shrink-0",
            open && "rotate-180"
          )}
        />
      </button>
      <motion.div
        initial={false}
        animate={{ height: open ? "auto" : 0, opacity: open ? 1 : 0 }}
        transition={{ duration: 0.28, ease: "easeOut" }}
        className="overflow-hidden px-6"
      >
        <div className="pb-5 text-[#909090] leading-relaxed">{a}</div>
      </motion.div>
    </div>
  );
}

export function Landing() {
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [projectType, setProjectType] = useState("");
  const [budget, setBudget] = useState("");
  const [faqOpen, setFaqOpen] = useState(0);

  const reduceMotion = useReducedMotion();

  const heroRef = useRef<HTMLDivElement | null>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });
  useTransform(scrollYProgress, [0, 1], [0, reduceMotion ? 0 : 70]);
  useTransform(scrollYProgress, [0, 1], [1, reduceMotion ? 1 : 0.65]);

  const features = useMemo(
    () => [
      {
        icon: <Wallet className="w-6 h-6 text-brand-orange" />,
        title: "Fair & Transparent Pricing",
        desc: "Set your max budget, no surprises. Contractors bid transparently so you always get the best price without unexpected costs.",
        accent: "#FE5F20",
      },
      {
        icon: <BadgeCheck className="w-6 h-6 text-brand-blue" />,
        title: "Verified Contractors Only",
        desc: "All contractors are licensed and reviewed. Work with trusted professionals — vetted for reliability and high-quality results.",
        accent: "#1336F6",
      },
      {
        icon: <Shield className="w-6 h-6 text-[#00DAFF]" />,
        title: "Project Tracking & Secure Payments",
        desc: "Manage everything from one place. Track progress, manage payments, and ensure work is completed before releasing funds.",
        accent: "#00DAFF",
      },
      {
        icon: <Search className="w-6 h-6 text-brand-navy" />,
        title: "Bidding System for the Best Offers",
        desc: "Contractors compete, you choose. Compare offers and pick the best fit with competitive pricing and multiple options.",
        accent: "#1F263E",
      },
    ],
    []
  );

  const steps = useMemo(
    () => [
      {
        icon: <ClipboardList className="w-5 h-5" />,
        title: "Post Your Project",
        desc: "Describe your renovation, set your budget, upload photos, and specify your timeline.",
      },
      {
        icon: <MessageSquare className="w-5 h-5" />,
        title: "Receive Contractor Bids",
        desc: "Qualified contractors review your project and submit competitive bids with pricing and timelines.",
      },
      {
        icon: <UserCheck className="w-5 h-5" />,
        title: "Choose Your Contractor",
        desc: "Compare profiles, reviews, and bids. Select the best professional that fits your needs and budget.",
      },
      {
        icon: <LayoutDashboard className="w-5 h-5" />,
        title: "Track Project Progress",
        desc: "Monitor every milestone in real time. Approve work stages and keep full visibility from start to finish.",
      },
      {
        icon: <CreditCard className="w-5 h-5" />,
        title: "Approve & Pay Securely",
        desc: "Release payments only after each milestone is completed and approved. Funds are always protected.",
      },
    ],
    []
  );

  const testimonials = useMemo(
    () => [
      {
        name: "John Mitchell",
        role: "Licensed General Contractor",
        text: "This platform changed how I find clients. No more wasted time—only serious homeowners, clear scope, and fair competition.",
      },
      {
        name: "Sarah Bennett",
        role: "Homeowner",
        text: "The process was stress-free. I set my budget, compared bids, and stayed in control the whole time. Transparent and fast.",
      },
      {
        name: "David Rosenberg",
        role: "Home Renovation Specialist",
        text: "Secure milestone payments made a huge difference. Everything stays professional and organized from start to finish.",
      },
      {
        name: "Jessica Moore",
        role: "First-Time Renovator",
        text: "I was nervous about my first renovation, but the verified contractors and clear bidding system made it so easy. Highly recommended.",
      },
      {
        name: "Michael Thompson",
        role: "Property Investor",
        text: "Managing multiple renovation projects is now effortless. The tracking tools and milestone payments keep everything on budget and on time.",
      },
      {
        name: "Lisa Carter",
        role: "Electrical & Plumbing Expert",
        text: "As a specialist contractor, I love how the platform matches me with the right projects. Less overhead, more quality work.",
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
        a: "You'll be notified immediately and can choose a replacement from existing bids. Support can help you match quickly.",
      },
      {
        q: "Can I edit my project details after submission?",
        a: "Yes. You can update your project description, budget, and timeline at any point before a bid is accepted.",
      },
      {
        q: "How long does it take to receive contractor bids?",
        a: "Most projects receive bids within 24–48 hours, depending on the scope of work and contractor availability.",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen text-slate-900 relative overflow-x-hidden">
      <img src={backgroundLandingPAge} alt="" className="absolute top-0 left-0 w-full pointer-events-none" />

      {/* ── NAV ── */}
      <nav className="sticky top-0 z-50 bg-white border-b border-[#E8E8E8]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-16 flex items-center justify-between">
            <img src={logo} alt="M.G.BIT Logo" className="h-5 w-auto" />

            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-navy">
              <a href="#home" className="hover:text-brand-blue transition-colors">Home</a>
              <a href="#how" className="hover:text-brand-blue transition-colors">How it Works</a>
              <a href="#contractors" className="hover:text-brand-blue transition-colors">Find Contractors</a>
              <a href="#support" className="hover:text-brand-blue transition-colors">Contact & Support</a>
            </div>

            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-4">
                <button
                  onClick={() => navigate("/login")}
                  className="px-6 py-2.5 rounded-full text-brand-navy font-bold hover:bg-slate-50 transition-all"
                >
                  Log In
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  className="px-6 py-2.5 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold transition-all shadow-md hover:shadow-lg active:scale-95"
                >
                  Sign Up
                </button>
              </div>

              <button
                onClick={() => setMobileOpen((s) => !s)}
                className="md:hidden p-2 rounded-lg hover:bg-slate-100"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={mobileOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                </svg>
              </button>
            </div>
          </div>

          <div className={cn("md:hidden", mobileOpen ? "block" : "hidden")}>
            <div className="px-4 pb-4 space-y-3">
              <a onClick={() => setMobileOpen(false)} href="#home" className="block text-brand-navy py-2">Home</a>
              <a onClick={() => setMobileOpen(false)} href="#how" className="block text-brand-navy py-2">How it Works</a>
              <a onClick={() => setMobileOpen(false)} href="#contractors" className="block text-brand-navy py-2">Find Contractors</a>
              <a onClick={() => setMobileOpen(false)} href="#support" className="block text-brand-navy py-2">Contact & Support</a>
              <div className="pt-2 border-t border-slate-100 mt-2 flex flex-col gap-2">
                <button onClick={() => navigate("/login")} className="w-full px-4 py-2 rounded-full border border-[#D9D9D9] text-brand-navy text-sm font-semibold">Log In</button>
                <button onClick={() => navigate("/signup")} className="w-full px-4 py-2 rounded-full bg-brand-orange text-white text-sm font-semibold">Sign Up</button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <div className="z-10">

        {/* ── HERO ── */}
        <section id="home" ref={heroRef} className="relative pt-12 sm:pt-20 pb-12 sm:pb-24 min-h-[80vh] sm:min-h-[90vh] flex items-center">
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              variants={container}
              className="flex flex-col items-center"
            >
              <motion.h1
                variants={item}
                className="text-[2.4rem] sm:text-5xl md:text-8xl lg:text-[90px] font-extrabold tracking-[-0.03em] text-brand-navy leading-[1.1] md:leading-[1] max-w-5xl"
              >
                Transparent & Hassle<br className="hidden md:block" />
                -Free Renovations.
              </motion.h1>

              <motion.p
                variants={item}
                className="mt-8 text-xl md:text-2xl text-brand-navy/60 max-w-3xl leading-relaxed"
              >
                Get fair pricing, verified contractors, and full project control – all in one place.
              </motion.p>

              <motion.div variants={item} className="mt-8 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-4 w-full sm:w-auto">
                <button
                  onClick={() => navigate("/signup")}
                  className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-base sm:text-lg transition-all shadow-[0_8px_30px_rgb(254,95,32,0.3)] flex items-center justify-center gap-2 active:scale-95"
                >
                  Start Your Project
                  <ArrowRight className="w-5 h-5" />
                </button>
                <button
                  onClick={() => navigate("/signup")}
                  className="px-8 sm:px-10 py-4 sm:py-5 rounded-full bg-white hover:bg-slate-50 text-brand-navy font-bold text-base sm:text-lg border border-slate-200 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  View Pricing
                </button>
              </motion.div>

              <motion.div
                variants={item}
                className="mt-10 sm:mt-20 relative w-full h-[260px] sm:h-[400px] md:h-[600px] flex justify-center items-end"
              >
                <div className="relative w-full max-w-6xl aspect-[2/1] pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-t from-white via-transparent to-transparent z-10" />
                  <img
                    src={landingPage}
                    alt="Renovation Illustration"
                    className="w-full h-full object-contain object-bottom opacity-90"
                  />
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── FEATURES ── */}
        <section className="py-24 bg-[#FAFAFB]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={container}
            >
              <div className="text-center mb-20">
                <motion.h2 variants={item} className="text-[1.9rem] sm:text-4xl md:text-[56px] font-extrabold text-brand-navy tracking-tight leading-[1.1]">
                  Powerful Features for a <br className="hidden md:block" /> Smooth Renovation Process
                </motion.h2>
                <motion.p variants={item} className="mt-4 sm:mt-6 text-base sm:text-xl text-[#909090] max-w-3xl mx-auto">
                  Our platform ensures a seamless renovation experience with fair pricing, verified contractors, and full project control – all in one place.
                </motion.p>
              </div>

              <motion.div variants={container} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
                {features.map((f) => (
                  <motion.div
                    key={f.title}
                    variants={item}
                    className="group p-8 rounded-[20px] bg-[#F7F7F7] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 flex flex-col items-center text-center"
                  >
                    {/* Icon container: white bg + colored accent dot */}
                    <div className="relative w-16 h-16 mb-6">
                      <div className="w-16 h-16 rounded-2xl bg-white shadow-sm flex items-center justify-center transition-all group-hover:scale-110 duration-300">
                        <div className="scale-125">{f.icon}</div>
                      </div>
                      <div
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full"
                        style={{ backgroundColor: f.accent }}
                      />
                    </div>
                    <h3 className="text-xl font-bold text-brand-navy leading-tight mb-3">
                      {f.title}
                    </h3>
                    <p className="text-[#909090] leading-relaxed text-[15px]">
                      {f.desc}
                    </p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── KICKSTART FORM ── */}
        <section id="kickstart" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              variants={container}
              className="rounded-[20px] bg-[#F6F7FF] border border-[#D0D6FF] p-6 sm:p-10 lg:p-20 relative"
            >
              <div className="relative z-10 text-center mb-16">
                <motion.h2 variants={item} className="text-[1.9rem] sm:text-4xl md:text-[56px] font-extrabold text-brand-navy tracking-tight leading-[1.1] mb-4 sm:mb-6">
                  Kickstart Your Renovation <br className="hidden md:block" /> in Just a Few Clicks
                </motion.h2>
                <motion.p variants={item} className="mt-3 sm:mt-4 text-base sm:text-xl text-[#909090] max-w-3xl mx-auto leading-relaxed">
                  Choose your project type, set your budget, and get an instant estimate – hassle-free and transparent from the start.
                </motion.p>
              </div>

              <motion.div variants={item} className="max-w-5xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-stretch">
                  <div className="relative">
                    <select
                      value={projectType}
                      onChange={(e) => setProjectType(e.target.value)}
                      className="w-full h-[60px] rounded-full bg-white border border-[#D9D9D9] px-8 text-brand-navy outline-none focus:border-brand-blue appearance-none cursor-pointer transition-all"
                    >
                      <option value="">Select Project Type</option>
                      <option>Kitchen Remodel</option>
                      <option>Bathroom Renovation</option>
                      <option>Flooring</option>
                      <option>Painting</option>
                      <option>Full Home Renovation</option>
                      <option>Outdoor / Landscaping</option>
                    </select>
                    <ChevronDown className="absolute right-6 top-1/2 -translate-y-1/2 w-5 h-5 text-[#909090] pointer-events-none" />
                  </div>

                  <div className="relative">
                    <input
                      value={budget}
                      onChange={(e) => setBudget(e.target.value)}
                      placeholder="Enter Your Budget..."
                      className="w-full h-[60px] rounded-full bg-white border border-[#D9D9D9] px-12 text-brand-navy outline-none focus:border-brand-blue placeholder:text-[#909090] transition-all"
                    />
                    <span className="absolute left-6 top-1/2 -translate-y-1/2 text-[#909090] font-bold">$</span>
                  </div>

                  <button
                    onClick={() => navigate("/signup")}
                    className="h-[60px] px-10 rounded-full bg-brand-orange hover:bg-orange-600 text-white font-bold text-lg transition-all shadow-[0_4px_20px_rgba(254,95,32,0.3)] flex items-center justify-center gap-2 active:scale-95 whitespace-nowrap md:col-span-2 lg:col-span-1"
                  >
                    Start Your Project
                    <ArrowRight className="w-5 h-5" />
                  </button>
                </div>

                <div className="mt-10 flex flex-wrap items-center justify-center gap-10 text-sm sm:text-base text-[#909090] font-medium">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand-orange" />
                    No hidden fees
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand-orange" />
                    Verified pros only
                  </span>
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-brand-orange" />
                    Milestone payments
                  </span>
                </div>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── HOW IT WORKS ── */}
        {/* <section id="how" className="py-24 bg-[#FAFAFB]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={container}
            >
              <div className="text-center mb-20">
                <motion.h2 variants={item} className="text-4xl md:text-[56px] font-extrabold text-brand-navy tracking-tight leading-[1.1]">
                  How it Works
                </motion.h2>
                <motion.p variants={item} className="mt-6 text-xl text-[#909090] max-w-2xl mx-auto">
                  Simple. Transparent. Controlled. Everything stays clear and managed from start to finish.
                </motion.p>
              </div>

              <motion.div variants={container} className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6">
                {steps.map((s, idx) => (
                  <motion.div
                    key={s.title}
                    variants={item}
                    className="rounded-[20px] border border-[#CFCFCF] bg-white p-8 hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300 group relative flex flex-col"
                  >
                    <div className="absolute top-6 right-6 text-5xl font-black text-slate-50 group-hover:text-brand-blue/10 transition-colors duration-300 select-none">
                      {idx + 1}
                    </div>
                    <div className="w-14 h-14 rounded-2xl bg-brand-navy text-white flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 relative z-10 shadow-md">
                      {s.icon}
                    </div>
                    <h3 className="text-lg font-bold text-brand-navy mb-3 relative z-10">{s.title}</h3>
                    <p className="text-[#909090] text-sm leading-relaxed relative z-10">{s.desc}</p>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section> */}

        {/* ── TESTIMONIALS ── */}
        <section className="py-24 bg-white" id="contractors">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={container}
            >
              <div className="text-center mb-20">
                <motion.h2 variants={item} className="text-[1.9rem] sm:text-4xl md:text-[56px] font-extrabold text-brand-navy tracking-tight max-w-4xl mx-auto leading-[1.1]">
                  What Our Customers Are Saying About Their Experience
                </motion.h2>
                <motion.p variants={item} className="mt-4 sm:mt-6 text-base sm:text-xl text-[#909090] max-w-3xl mx-auto">
                  See what real clients and professionals have to say – from seamless renovations to reliable, high-quality work.
                </motion.p>
              </div>

              <motion.div variants={container} className="grid lg:grid-cols-3 gap-6">
                {testimonials.map((t) => (
                  <motion.div
                    key={t.name}
                    variants={item}
                    className="overflow-hidden rounded-[20px] bg-[#F8F8F8] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] transition-all duration-300"
                  >
                    {/* Blue accent bar */}
                    <div className="h-1.5 bg-brand-blue w-full" />

                    <div className="p-8">
                      {/* Avatar + name + verified */}
                      <div className="flex items-center gap-4 mb-5">
                        <div className="w-12 h-12 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold text-lg shrink-0">
                          {t.name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-brand-navy text-[16px] leading-tight">{t.name}</div>
                          <div className="text-sm text-[#909090] mt-0.5 truncate">{t.role}</div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-brand-blue font-semibold bg-[#EDF3FF] px-2.5 py-1 rounded-full shrink-0">
                          <BadgeCheck className="w-3.5 h-3.5" />
                          Verified
                        </div>
                      </div>

                      {/* Stars */}
                      <div className="flex items-center gap-1 mb-4">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-brand-orange fill-current" />
                        ))}
                        <span className="text-xs text-[#909090] ml-1 font-medium">(5 Stars)</span>
                      </div>

                      {/* Quote */}
                      <p className="text-brand-navy/80 leading-relaxed text-[15px]">
                        "{t.text}"
                      </p>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-24 bg-[#FAFAFB]" id="support">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.2 }}
              variants={container}
            >
              <div className="text-center mb-16">
                <motion.h2 variants={item} className="text-[1.9rem] sm:text-4xl md:text-6xl font-extrabold text-brand-navy tracking-tight">
                  Frequently Asked <br /> Questions
                </motion.h2>
                <motion.p variants={item} className="mt-3 sm:mt-4 text-base sm:text-xl text-[#909090] max-w-3xl mx-auto">
                  Got questions? We've got answers. Explore the most common inquiries about pricing, contractor reliability, project changes, and more.
                </motion.p>
              </div>

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

            </motion.div>
          </div>
        </section>

      </div>

      <Footer />
    </div>
  );
}
