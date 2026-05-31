"use client";

import { motion, type Variants } from "framer-motion";
import { useScrollTo } from "@/lib/scroll-context";
import { useAudioGlow } from "@/hooks/use-audio-glow";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";

// Audio-reactive COLOUR + GLOW. useAudioGlow writes two vars onto the heading
// each frame: --audio-tint (a colour sampled from the desk's shared intensity
// ramp — cold blue when quiet → gold on a peak) and --audio-glow (the raw 0..1
// intensity). The "Sufian" line takes the tint directly; at rest both vars are
// unset so it falls back to ink with no bloom.
//
// The text now LIGHTS UP as it shifts colour: a tint-coloured text-shadow whose
// blur radius and opacity both scale with --audio-glow, so the wordmark sits
// dark+flat in silence and blooms warm on a peak. --audio-glow is already eased
// in the hook (one-pole smoothing) and the colour/shadow each carry a CSS
// transition, so the rise and fall animate smoothly instead of snapping. Both
// the colour and the glow go to zero at silence (the hook clears the tint and
// drives glow to 0), so the bloom recedes on its own when the music stops.
const heroGlowStyle: React.CSSProperties = {
  // @ts-expect-error — custom property, valid CSS, not in the TS type
  "--audio-glow": 0,
  color: "var(--audio-tint, var(--color-ink))",
  // Glow blooms in the live tint colour. Two stacked shadows: a tight core that
  // lifts the glyph edges and a wide halo that spreads on peaks. Both fade to
  // nothing as --audio-glow → 0 (color-mix alpha rides the var), and the blur
  // radius grows with intensity. Falls back to a fully-transparent shadow when
  // the tint is unset, so resting type casts no light.
  textShadow:
    "0 0 calc(2px + var(--audio-glow, 0) * 6px) color-mix(in srgb, var(--audio-tint, transparent) calc(var(--audio-glow, 0) * 70%), transparent), " +
    "0 0 calc(8px + var(--audio-glow, 0) * 26px) color-mix(in srgb, var(--audio-tint, transparent) calc(var(--audio-glow, 0) * 45%), transparent)",
  // Ease the bloom + colour. The hook already one-pole-smooths --audio-glow, so
  // the per-frame values arrive smooth; this short transition mainly softens the
  // silence→onset and peak→decay edges without lagging behind fast beats.
  transition: "text-shadow 90ms linear, color 90ms linear",
};

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
  const titleRef = useAudioGlow<HTMLHeadingElement>();
  const { lang } = useLanguage();
  const t = dict(lang).hero;
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
          {t.eyebrow}
        </motion.p>
      </div>

      <motion.div
        variants={blockStagger}
        initial="hidden"
        animate="show"
        className="relative z-10 container-edge"
      >
        {/*
          Headline wrapper. variants=letterStagger drives the per-letter
          reveal on mount (it inherits the parent's "show" state, which
          cascades the stagger to the letter spans). After the reveal the
          title sits STILL — the old perpetual letter-spacing "breathing"
          loop was removed (it read as the title drifting/moving for no
          reason). The only life on the wordmark now is the audio colour
          tint (--audio-tint, via heroGlowStyle).
        */}
        <motion.h1
          ref={titleRef}
          style={heroGlowStyle}
          variants={letterStagger}
          className="font-display text-display leading-[var(--text-display--line-height)] text-balance text-legible"
        >
          <span className="block" aria-label="Sufian">
            <SplitWord word="Sufian" />
          </span>
          {/* "Kraitt" rests a step muted vs "Sufian", but shares the same
              audio tint at intensity — fallback to ink-muted when the var
              is unset so the two-tone wordmark holds while the music is off. */}
          <span
            className="block"
            style={{ color: "var(--audio-tint, var(--color-ink-muted))" }}
            aria-label="Kraitt."
          >
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
          className="mt-12 md:mt-16 max-w-[50ch] text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body text-legible"
        >
          {t.leadIn}
          <span className="font-serif-italic text-ink">{t.film}</span>,{" "}
          <span className="font-serif-italic text-ink">{t.television}</span>
          {lang === "de" ? " und " : ", "}
          <span className="font-serif-italic text-ink">{t.music}</span>
          {t.leadOut}
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
            {t.tags.map((tag) => (
              <span key={tag}>{tag}</span>
            ))}
          </div>
          <a
            href="#ueber"
            onClick={scrollTo("ueber")}
            className="group inline-flex items-center gap-3 text-ink-muted hover:text-ink transition-colors"
          >
            {t.scroll}
            <span className="block h-px w-12 bg-current group-hover:w-20 transition-all duration-700" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
