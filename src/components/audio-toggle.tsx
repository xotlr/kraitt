"use client";

import { motion } from "framer-motion";
import { useAudio } from "@/lib/audio";
import { cn } from "@/lib/utils";

/**
 * Two small pill controls — music + mic — styled to match the mono
 * eyebrow type in the nav. The underline mirrors the section-nav
 * active-state pattern so the audio buttons feel like part of the
 * same control surface, not pasted in.
 */
export function AudioToggles({ className }: { className?: string }) {
  const { musicOn, micOn, musicStatus, toggleMusic, toggleMic } = useAudio();

  // Music button label depends on three states: idle, playing,
  // unavailable. Unavailable wins for ~2.4s after a failed play() so
  // the user sees clearly that nothing happened.
  const musicLabel =
    musicStatus === "unavailable"
      ? "Audio nicht verfügbar"
      : musicOn
      ? "Stille"
      : "Klang";

  return (
    <div
      className={cn(
        "flex items-center gap-5 font-mono text-[10px] uppercase tracking-[0.22em]",
        className
      )}
    >
      <button
        type="button"
        onClick={toggleMusic}
        aria-pressed={musicOn}
        disabled={musicStatus === "unavailable"}
        className={cn(
          "relative px-1 py-2 transition-colors duration-500",
          musicStatus === "unavailable"
            ? "text-ink-faint cursor-not-allowed"
            : musicOn
            ? "text-ink"
            : "text-ink-muted hover:text-ink"
        )}
      >
        <span className="inline-flex items-center gap-2">
          <Wave on={musicOn} />
          {musicLabel}
        </span>
        {musicOn && (
          <motion.span
            layoutId="audio-underline"
            className="absolute inset-x-1 -bottom-px h-px bg-ink"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </button>

      <button
        type="button"
        onClick={toggleMic}
        aria-pressed={micOn}
        className={cn(
          "relative px-1 py-2 transition-colors duration-500",
          micOn ? "text-ink" : "text-ink-muted hover:text-ink"
        )}
      >
        <span className="inline-flex items-center gap-2">
          <MicDot on={micOn} />
          Mic
        </span>
        {micOn && (
          <motion.span
            layoutId="mic-underline"
            className="absolute inset-x-1 -bottom-px h-px bg-ink"
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
          />
        )}
      </button>
    </div>
  );
}

/** Tiny animated "speaker waveform" indicator. */
function Wave({ on }: { on: boolean }) {
  return (
    <span className="inline-flex items-end gap-[2px] h-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn(
            "block w-px bg-current transition-all duration-500",
            on ? "animate-pulse" : ""
          )}
          style={{
            height: on ? `${[6, 10, 7][i]}px` : "3px",
            animationDelay: `${i * 120}ms`,
          }}
        />
      ))}
    </span>
  );
}

function MicDot({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "block h-[6px] w-[6px] rounded-full transition-colors",
        on ? "bg-current" : "bg-current/40"
      )}
    />
  );
}
