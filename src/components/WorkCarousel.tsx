import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";

/* ─────────────────────────────────────────────────────────────
   Renovation / contractor work carousel.
   Two modes:
     • <WorkCarousel />          → framed "Our Work" section
     • <WorkCarousel hero>…</>   → full-bleed hero background with the
                                   passed children overlaid on top.
   To use your own project photos, swap the `src` values in SLIDES.
   Keep landscape (≈16:9) images for a consistent frame.
   ───────────────────────────────────────────────────────────── */

interface Slide {
  src: string;
  label: string;
}

const IMG = (id: string) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=1920&q=80`;

const SLIDES: Slide[] = [
  { src: IMG("1600585154340-be6161a56a0c"), label: "Full-home renovation" },
  { src: IMG("1600607687939-ce8a6c25118c"), label: "Kitchen & open-plan remodel" },
  { src: IMG("1600566753086-00f18fb6b3ea"), label: "Living space transformation" },
  { src: IMG("1618221195710-dd6b41faaea6"), label: "Modern interior finish" },
  { src: IMG("1521783988139-89397d761dce"), label: "Bedroom refresh" },
  { src: IMG("1503174971373-b1f69850bded"), label: "Indoor–outdoor living" },
];

const AUTOPLAY_MS = 5000;

export function WorkCarousel({
  hero = false,
  children,
}: {
  hero?: boolean;
  children?: React.ReactNode;
}) {
  const reduce = useReducedMotion();
  const [[index, dir], setState] = useState<[number, number]>([0, 0]);
  const [paused, setPaused] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback((next: number, direction: number) => {
    const len = SLIDES.length;
    setState([(next + len) % len, direction]);
  }, []);

  const next = useCallback(() => go(index + 1, 1), [go, index]);
  const prev = useCallback(() => go(index - 1, -1), [go, index]);

  // Preload every slide so crossfades never show a blank frame.
  useEffect(() => {
    SLIDES.forEach((s) => {
      const img = new Image();
      img.src = s.src;
    });
  }, []);

  useEffect(() => {
    if (paused || reduce) return;
    timer.current = setInterval(() => {
      setState(([i]) => [(i + 1) % SLIDES.length, 1]);
    }, AUTOPLAY_MS);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [paused, reduce]);

  const slide = SLIDES[index];

  // Animated full-bleed image layer, shared by both modes.
  const imageLayer = (
    <AnimatePresence initial={false} custom={dir} mode="popLayout">
      <motion.div
        key={index}
        custom={dir}
        initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? 60 : -60 }}
        animate={{ opacity: 1, x: 0 }}
        exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir > 0 ? -60 : 60 }}
        transition={{ duration: 0.7, ease: "easeInOut" }}
        className="absolute inset-0"
      >
        <img
          src={slide.src}
          alt={slide.label}
          className="absolute inset-0 w-full h-full object-cover"
        />
      </motion.div>
    </AnimatePresence>
  );

  const Dot = ({ i }: { i: number }) => (
    <button
      onClick={() => go(i, i > index ? 1 : -1)}
      aria-label={`Go to slide ${i + 1}`}
      className={`h-2 rounded-full transition-all ${
        i === index ? "w-7 bg-brand-orange" : "w-2 bg-white/50 hover:bg-white"
      }`}
    />
  );

  const ArrowBtn = ({ dirBtn }: { dirBtn: "prev" | "next" }) => (
    <button
      onClick={dirBtn === "prev" ? prev : next}
      aria-label={dirBtn === "prev" ? "Previous" : "Next"}
      className="w-11 h-11 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur border border-white/25 text-white flex items-center justify-center transition-colors active:scale-95"
    >
      {dirBtn === "prev" ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
    </button>
  );

  // ── HERO MODE ────────────────────────────────────────────────────────────
  if (hero) {
    return (
      <section
        id="home"
        className="relative min-h-[86vh] flex items-center overflow-hidden"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="absolute inset-0">{imageLayer}</div>
        {/* Brand scrim — darkest on the left/bottom where the copy sits */}
        <div className="absolute inset-0 bg-gradient-to-r from-brand-navy/90 via-brand-navy/60 to-brand-navy/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-navy/80 via-transparent to-transparent" />

        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          {children}
        </div>

        {/* Controls */}
        <div className="absolute z-10 bottom-6 sm:bottom-8 left-0 right-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              {SLIDES.map((_, i) => (
                <Dot key={i} i={i} />
              ))}
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <ArrowBtn dirBtn="prev" />
              <ArrowBtn dirBtn="next" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  // ── SECTION MODE ─────────────────────────────────────────────────────────
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <p className="text-sm font-bold uppercase tracking-widest text-brand-orange mb-3">
            Our Work
          </p>
          <h2 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-brand-navy leading-tight">
            Renovations built to a professional standard.
          </h2>
          <p className="mt-5 text-lg text-brand-navy/55 leading-relaxed">
            From full-home remodels to kitchens, bathrooms, and extensions — see the quality
            our verified contractors deliver.
          </p>
        </div>

        <div
          className="relative rounded-[24px] overflow-hidden shadow-[0_20px_60px_rgba(31,38,62,0.18)] bg-brand-navy"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          <div className="relative aspect-[16/10] sm:aspect-[16/9]">
            {imageLayer}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent pointer-events-none" />
            <div className="absolute left-5 bottom-5 sm:left-8 sm:bottom-8">
              <span className="inline-flex items-center px-4 py-2 rounded-full bg-white/15 backdrop-blur text-white text-sm font-semibold border border-white/20">
                {slide.label}
              </span>
            </div>

            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute left-3 sm:left-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-brand-navy flex items-center justify-center shadow-lg transition-colors active:scale-95"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute right-3 sm:right-5 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/90 hover:bg-white text-brand-navy flex items-center justify-center shadow-lg transition-colors active:scale-95"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <Dot key={i} i={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
