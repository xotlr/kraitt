"use client";

import { Microphone, Pause, Play } from "@phosphor-icons/react";
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
      className="hidden lg:flex shrink-0 flex-col items-center gap-2 select-none"
      style={{
        width: "var(--console-left-rail-w)",
        paddingTop: "var(--console-rail-inset)",
        paddingBottom: "var(--console-rail-inset)",
      }}
    >
      {/* Brand plate — the wordmark sits at the top of the left rail, the
          desk's name tag. Housed in the same recessed navpill as every other
          cluster so the rail reads as one language top to bottom; the anchor
          keeps the --console-unit box so its rhythm matches the caps below.
          Links home. */}
      <motion.div variants={item} className="console-group">
        <a
          href="#hero"
          onClick={scrollTo("hero")}
          className="flex items-center justify-center font-display text-sm leading-none text-ink-muted hover:text-ink transition-colors"
          style={{ width: "var(--console-unit)", height: "var(--console-unit)" }}
        >
          sk
        </a>
      </motion.div>

      {/* Source select — the two inputs feeding the strip. Colour-coded by
          function: the music TRANSPORT plays/pauses the track (green when
          playing), MIC is a record/input source (red when live), the way a
          desk colours its caps. */}
      <motion.div
        variants={item}
        role="group"
        aria-label="Audioquellen"
        className="console-group flex flex-col items-center gap-1.5"
      >
        <StudioButton
          active={musicOn}
          tone="play"
          dot
          disabled={musicStatus === "unavailable"}
          onClick={toggleMusic}
          ariaLabel={
            musicStatus === "unavailable"
              ? "Musik — nicht verfügbar"
              : musicOn
                ? "Pause"
                : "Wiedergabe"
          }
        >
          {/* Transport: Play when stopped, Pause when playing. Filled
              weight so the glyph reads as a solid transport cap. */}
          {musicOn ? (
            <Pause size={17} weight="fill" />
          ) : (
            <Play size={17} weight="fill" />
          )}
        </StudioButton>
        <StudioButton
          active={micOn}
          tone="rec"
          dot
          onClick={toggleMic}
          ariaLabel="Mikrofon"
        >
          <Microphone size={19} weight={micOn ? "fill" : "regular"} />
        </StudioButton>
      </motion.div>

      {/* Channel strip — a real fader beside a dBFS meter ladder, filling
          the rest of the column down to a small bottom inset (matches the
          top inset so it reads centered rather than floating mid-rail).
          Housed in the same recessed navpill as the button clusters so the
          whole rail reads as one language: every module sits DOWN IN a
          shallow trough. The pill's padding (--console-group-pad) frames the
          strip exactly as it frames a row of caps, so the strip's outer width
          lines up flush with the source-button pill above it. */}
      <motion.div
        variants={item}
        className="console-group min-h-0 flex-1 flex-col"
        style={{
          // Outer pill width = strip content (one cap wide) + the pill's own
          // padding on both sides, so the strip's content column stays exactly
          // --console-strip-w and the pill's outer edge lines up with the
          // source-button pill above (same content + same pad = same width).
          width:
            "calc(var(--console-strip-w) + var(--console-group-pad, 6px) * 2)",
        }}
      >
        <ChannelStrip />
      </motion.div>
    </motion.div>
  );
}
