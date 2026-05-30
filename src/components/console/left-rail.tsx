"use client";

import { Microphone, MusicNotes } from "@phosphor-icons/react";
import { motion, type Variants } from "framer-motion";
import { ChannelStrip } from "@/components/console/level-meter";
import { StudioButton } from "@/components/console/studio-button";
import { useAudio } from "@/lib/audio";
import { useScrollTo } from "@/lib/scroll-context";

/**
 * LeftRail — the LEFT console column. A single vertical row: the two
 * audio source buttons (MUS / MIC) feeding an Apple-style LevelMeter that
 * visualizes + sets volume. Width is the modular --console-rail-w token
 * (shared with the right rail); the meter is exactly one --console-unit
 * wide so it lines up with the buttons.
 *
 * Children stagger in on mount. lg+ only.
 */
const rail: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function LeftRail() {
  const { musicOn, micOn, musicStatus, toggleMusic, toggleMic } = useAudio();
  const scrollTo = useScrollTo();

  return (
    <motion.div
      variants={rail}
      initial="hidden"
      animate="show"
      className="hidden lg:flex shrink-0 flex-col items-center gap-5"
      style={{
        width: "var(--console-left-rail-w)",
        paddingTop: "var(--console-rail-inset)",
        paddingBottom: "var(--console-rail-inset)",
      }}
    >
      {/* Brand plate — the wordmark sits at the top of the left rail, the
          desk's name tag. Given the same --console-unit box as a button so
          its spacing rhythm matches the buttons below it. Links home. */}
      <motion.a
        variants={item}
        href="#hero"
        onClick={scrollTo("hero")}
        className="flex items-center justify-center font-display text-sm leading-none text-ink hover:text-ink-muted transition-colors"
        style={{ width: "var(--console-unit)", height: "var(--console-unit)" }}
      >
        sk
      </motion.a>

      {/* Source select — the two inputs feeding the strip. Colour-coded by
          function: MUS is playback (green when live), MIC is a record/input
          source (red when live), the way a desk colours its caps. Small
          mono labels name them like a channel-strip source row. */}
      <motion.div variants={item}>
        <StudioButton
          active={musicOn}
          tone="play"
          dot
          onClick={musicStatus === "unavailable" ? undefined : toggleMusic}
          ariaLabel="Musik"
        >
          <MusicNotes size={24} weight={musicOn ? "fill" : "regular"} />
        </StudioButton>
      </motion.div>
      <motion.div variants={item}>
        <StudioButton
          active={micOn}
          tone="rec"
          dot
          onClick={toggleMic}
          ariaLabel="Mikrofon"
        >
          <Microphone size={24} weight={micOn ? "fill" : "regular"} />
        </StudioButton>
      </motion.div>

      {/* Channel strip — a real fader beside a dBFS meter ladder, filling
          the rest of the column down to a small bottom inset (matches the
          top inset so it reads centered rather than floating mid-rail). */}
      <motion.div
        variants={item}
        className="min-h-0 flex-1"
        style={{ width: "var(--console-strip-w)" }}
      >
        <ChannelStrip />
      </motion.div>
    </motion.div>
  );
}
