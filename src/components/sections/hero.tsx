"use client";

import { motion, type Variants } from "framer-motion";
import { useScrollTo } from "@/lib/scroll-context";

/* ------------------------------------------------------------------ */
/*  Reveal choreography                                                */
/* ------------------------------------------------------------------ */

/**
 * Outer stagger for the hero block: kicks off after the eyebrow has
 * settled (delayChildren) and walks through its direct children
 * (headline wrapper + body paragraph) one at a time.
 */
const blockStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.18, delayChildren: 0.5 } },
};

/**
 * Inner stagger for the headline itself. Each child is one letter
 * span; ~25ms between letters gives the title-sequence cadence —
 * fast enough to read as one word, slow enough that you feel the
 * shutter open per glyph.
 */
const letterStagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.025 } },
};

/**
 * Per-letter reveal. Letters start slightly dropped, fully transparent,
 * and visually de-focused via blur; they resolve in place. The cubic
 * curve is the same "soft snap" used elsewhere on the site so the
 * letters feel decelerated rather than spring-y.
 */
const letterReveal: Variants = {
  hidden: { y: 28, opacity: 0, filter: "blur(10px)" },
  show: {
    y: 0,
    opacity: 1,
    filter: "blur(0px)",
    transition: { duration: 1.1, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Body copy uses a simpler rise — we don't want it competing with
 * the letter-by-letter reveal above it.
 */
const rise: Variants = {
  hidden: { y: 40, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
  },
};

/**
 * Split a word into individually animated letter spans. We keep the
 * markup as inline-block spans so transforms apply per-glyph without
 * breaking the line box. No external splitting library — the words
 * are short and known at build time.
 */
function SplitWord({ word }: { word: string }) {
  return (
    <>
      {word.split("").map((char, i) => (
        <motion.span
          key={`${word}-${i}`}
          variants={letterReveal}
          className="inline-block"
          // Preserve the glyph; spaces would collapse but these words
          // contain none.
        >
          {char}
        </motion.span>
      ))}
    </>
  );
}

export function Hero() {
  const scrollTo = useScrollTo();
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-between overflow-hidden"
    >
      <div className="relative z-10 container-edge pt-32 md:pt-40">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.3 }}
          className="eyebrow flex items-center gap-3"
        >
          <span className="h-px w-10 bg-ink-faint" />
          Wien · Audio Engineer · Verfügbar 2026
        </motion.p>
      </div>

      <motion.div
        variants={blockStagger}
        initial="hidden"
        animate="show"
        className="relative z-10 container-edge"
      >
        {/*
          Headline wrapper. Two responsibilities:
          1. variants=letterStagger drives the per-letter reveal on mount.
          2. animate={{ letterSpacing }} runs the perpetual "breathing"
             once the reveal is done — letter-spacing drifts between the
             base tightest tracking (-0.045em, set by .font-display) and
             a hair looser (-0.040em) over 6s, mirror-eased, forever.
             It's small on purpose: noticeable only peripherally, like
             the title is inhaling.
        */}
        <motion.h1
          variants={letterStagger}
          animate={{
            letterSpacing: ["-0.045em", "-0.040em", "-0.045em"],
            transition: {
              duration: 6,
              ease: "easeInOut",
              repeat: Infinity,
              // Start the breathing only after the letter reveal has
              // had time to finish (8 letters * 0.025s + 1.1s duration
              // + 0.5s block delay ~= 1.8s, round up).
              delay: 2,
            },
          }}
          className="font-display text-display leading-[var(--text-display--line-height)] text-balance"
        >
          <span className="block" aria-label="Sufian">
            <SplitWord word="Sufian" />
          </span>
          <span className="block text-ink-muted" aria-label="Kraitt.">
            <SplitWord word="Kraitt" />
            {/* Dot picks up the string color so the wordmark belongs
                to the same cold palette as the shader. On hover it
                grows slightly — the only interactive flourish on the
                whole hero. Cubic curve matches the reveal easing for
                visual consistency. */}
            <motion.span
              variants={letterReveal}
              whileHover={{ scale: 1.15 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="inline-block text-[color:var(--color-string)] origin-bottom"
            >
              .
            </motion.span>
          </span>
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-12 md:mt-16 max-w-[50ch] text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body"
        >
          Audio für{" "}
          <span className="font-serif-italic text-ink">Film</span>,{" "}
          <span className="font-serif-italic text-ink">Television</span> und{" "}
          <span className="font-serif-italic text-ink">Musikproduktion</span>{" "}
          — am Set, im Studio, in der Post.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 1.4 }}
        className="relative z-10 container-edge pb-12 md:pb-16"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 eyebrow">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-ink-muted">
            <span>Setton</span>
            <span>Postproduktion</span>
            <span>Mixing</span>
            <span>Mastering</span>
            <span>Komposition</span>
          </div>
          <a
            href="#ueber"
            onClick={scrollTo("ueber")}
            className="group inline-flex items-center gap-3 text-ink-muted hover:text-ink transition-colors"
          >
            Scroll
            <span className="block h-px w-12 bg-current group-hover:w-20 transition-all duration-700" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
