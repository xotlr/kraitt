"use client";

import { useCallback, useRef } from "react";
import {
  Microphone,
  Pause,
  Play,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
} from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { LanguageToggle } from "@/components/console/language-toggle";
import { StudioButton } from "@/components/console/studio-button";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { useAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import { intensityColor, INTENSITY_RAMP } from "@/lib/utils";
import { EASE } from "@/lib/motion";

/**
 * MobileConsole — the < lg console, redesigned as two floating "islands"
 * (Apple Dynamic-Island grammar) instead of the old section-button strip:
 *
 *   ┌──────────────────────────────────────┐  TOP — the TRANSPORT.
 *   │ 1:24  ▕▂▅▇▃▁▆█▄▂▅▇▃▁▏  4:55  Nocturne │  A Pro-Tools-style scrubber:
 *   └──────────────────────────────────────┘  static waveform print of the
 *                                              track, a playhead riding it with
 *           (scene fills the middle)           playback, timecode either side.
 *                                              Drag/tap the bar to seek.
 *   ┌──────────────────────────────────────┐  BOTTOM — everything else:
 *   │ ▶ ● mic  ▕──●────▏ vol   ☀  DE        │  play/pause, mic, mute, theme,
 *   └──────────────────────────────────────┘  language, + a swipeable volume
 *                                              fader. NO section buttons.
 *
 * Both pills use the raised faceplate (.console-group--raised) so they read as
 * the same machined chrome as the desktop rails. lg:hidden — the rails take
 * over at lg+.
 */

const BOTTOM = { opacity: 0, y: 14 };
const SHOWN = { opacity: 1, y: 0 };

/** Format seconds as M:SS (the track is minutes-long; no hours needed). */
function timecode(sec: number): string {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** The scrubbable waveform transport (top pill). */
function Transport() {
  const { lang } = useLanguage();
  const c = dict(lang).console;
  const { waveform, currentTime, duration, seek, musicStatus } = useAudio();
  const trackRef = useRef<HTMLDivElement>(null);

  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  // Pointer → seek. Pointer capture so a drag that leaves the bar keeps
  // scrubbing, like a real transport. Maps x within the track to a 0..1 seek.
  const seekFromPointer = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      seek((clientX - r.left) / r.width);
    },
    [seek]
  );

  // Drag state via a ref, not hasPointerCapture: setPointerCapture can throw
  // (or be unavailable) and we must still seek. A captured pointer keeps firing
  // move on this element even off-bar; the ref gates the move either way.
  const dragging = useRef(false);
  const onPointerDown = (e: React.PointerEvent) => {
    dragging.current = true;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* capture is a nice-to-have; seek still works without it */
    }
    seekFromPointer(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (dragging.current) seekFromPointer(e.clientX);
  };
  const endDrag = () => {
    dragging.current = false;
  };

  // Bars: the decoded peak print, or a flat baseline placeholder before decode
  // (so the transport reads as a clip waiting for signal, not empty).
  const bars = waveform.length ? waveform : new Array(96).fill(0.12);
  // The playhead sits at `progress` across the bar set; bars before it read as
  // "played" (warmed by the intensity ramp), bars after as unplayed (faint).
  const playedColor = intensityColor(0.55, INTENSITY_RAMP);

  return (
    <div className="console-group console-group--raised flex items-center gap-3 px-3.5 py-2.5">
      <span className="mono-label tabular-nums text-ink-muted shrink-0">
        {timecode(currentTime)}
      </span>

      {/* The waveform scrub track. role=slider so it's an a11y seek control. */}
      <div
        ref={trackRef}
        role="slider"
        aria-label={c.transport}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        aria-valuetext={`${timecode(currentTime)} / ${timecode(duration)}`}
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") seek(progress + 0.02);
          else if (e.key === "ArrowLeft") seek(progress - 0.02);
        }}
        className="relative flex h-7 min-w-0 flex-1 items-center gap-px overflow-hidden rounded-[3px] cursor-pointer touch-none"
      >
        {bars.map((h, i) => {
          const played = i / bars.length <= progress;
          return (
            <span
              key={i}
              aria-hidden
              className="min-w-0 flex-1 rounded-[1px]"
              style={{
                height: `${Math.max(10, h * 100)}%`,
                background: played
                  ? playedColor
                  : "color-mix(in srgb, var(--color-ink-faint) 70%, transparent)",
                opacity: played ? 0.95 : 0.55,
                transition: "background 200ms linear, opacity 200ms linear",
              }}
            />
          );
        })}
        {/* Playhead — a thin bright line riding the scrub position. */}
        <span
          aria-hidden
          className="pointer-events-none absolute top-0 bottom-0 w-px"
          style={{
            left: `${progress * 100}%`,
            background: playedColor,
            boxShadow: `0 0 5px color-mix(in srgb, ${playedColor} 80%, transparent)`,
            opacity: musicStatus === "playing" ? 1 : 0.6,
          }}
        />
      </div>

      <span className="mono-label tabular-nums text-ink-faint shrink-0">
        {timecode(duration)}
      </span>
    </div>
  );
}

export function MobileConsole() {
  const { lang } = useLanguage();
  const c = dict(lang).console;
  const {
    musicOn,
    micOn,
    musicStatus,
    muted,
    volume,
    setVolume,
    toggleMusic,
    toggleMic,
    toggleMute,
  } = useAudio();

  // Swipeable volume: a horizontal fader inside the bottom pill. Pointer x
  // within the track maps to 0..1; pointer capture keeps the drag alive off-bar.
  const volRef = useRef<HTMLDivElement>(null);
  const setVolFromPointer = useCallback(
    (clientX: number) => {
      const el = volRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setVolume(Math.max(0, Math.min(1, (clientX - r.left) / r.width)));
    },
    [setVolume]
  );
  const volColor = intensityColor(volume, INTENSITY_RAMP);
  const volDragging = useRef(false);

  return (
    <div className="lg:hidden select-none">
      {/* TOP — transport island. Each pill is its OWN fixed element pinned to an
          edge (a single full-height fixed wrapper stretched and pushed the bottom
          pill off-screen). */}
      <motion.div
        initial={BOTTOM}
        animate={SHOWN}
        transition={{ duration: 1, delay: 0.5, ease: EASE }}
        className="pointer-events-auto fixed inset-x-0 top-0 z-40 px-[var(--gutter)] pt-[max(0.75rem,env(safe-area-inset-top))]"
      >
        <Transport />
      </motion.div>

      {/* BOTTOM — controls island */}
      <motion.div
        initial={BOTTOM}
        animate={SHOWN}
        transition={{ duration: 1, delay: 0.6, ease: EASE }}
        className="pointer-events-auto fixed inset-x-0 bottom-0 z-40 px-[var(--gutter)] pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <div className="console-group console-group--raised flex items-center gap-2.5 px-3 py-2.5">
          {/* Transport buttons */}
          <StudioButton
            active={musicOn}
            tone="play"
            dot
            size={44}
            disabled={musicStatus === "unavailable"}
            onClick={() => void toggleMusic()}
            ariaLabel={musicStatus === "unavailable" ? c.musicUnavailable : c.music}
          >
            {musicOn ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
          </StudioButton>
          <StudioButton
            active={micOn}
            tone="rec"
            dot
            size={44}
            onClick={() => void toggleMic()}
            ariaLabel={c.mic}
          >
            <Microphone size={20} weight={micOn ? "fill" : "regular"} />
          </StudioButton>

          {/* Swipeable volume fader — fills the middle. */}
          <div
            ref={volRef}
            role="slider"
            aria-label={c.volume}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(volume * 100)}
            tabIndex={0}
            onPointerDown={(e) => {
              volDragging.current = true;
              try {
                e.currentTarget.setPointerCapture(e.pointerId);
              } catch {
                /* capture optional; volume still sets without it */
              }
              setVolFromPointer(e.clientX);
            }}
            onPointerMove={(e) => {
              if (volDragging.current) setVolFromPointer(e.clientX);
            }}
            onPointerUp={() => {
              volDragging.current = false;
            }}
            onPointerCancel={() => {
              volDragging.current = false;
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight") setVolume(Math.min(1, volume + 0.05));
              else if (e.key === "ArrowLeft") setVolume(Math.max(0, volume - 0.05));
            }}
            className="console-recess-window relative flex h-9 min-w-0 flex-1 items-center overflow-hidden rounded-[5px] px-1 cursor-pointer touch-none"
          >
            {/* Filled level up to the volume position. */}
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-0 left-0 rounded-l-[5px]"
              style={{
                width: `${volume * 100}%`,
                background: `linear-gradient(90deg, color-mix(in srgb, ${volColor} 8%, transparent), color-mix(in srgb, ${volColor} 26%, transparent))`,
                transition: "width 90ms var(--ease-out-soft), background 200ms",
              }}
            />
            {/* The grabbable handle cap, riding the level position. */}
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 h-6 w-3 -translate-y-1/2 rounded-[3px]"
              style={{
                left: `calc(${volume} * (100% - 0.75rem - 12px) + 0.375rem)`,
                background:
                  "linear-gradient(115deg, var(--console-cap-hi) 0%, var(--console-cap) 50%, color-mix(in srgb, var(--console-cap) 78%, black) 100%)",
                boxShadow:
                  "inset 1px 1px 0 color-mix(in srgb, white 18%, transparent), inset -1px -1px 1px color-mix(in srgb, black 40%, transparent), 0 1px 3px color-mix(in srgb, black 55%, transparent), 0 0 0 1px var(--console-edge)",
              }}
            >
              <span
                className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 rounded-full"
                style={{ background: volColor, boxShadow: `0 0 4px color-mix(in srgb, ${volColor} 60%, transparent)` }}
              />
            </span>
          </div>

          {/* Mute + settings */}
          <StudioButton
            active={muted}
            tone="rec"
            dot
            size={44}
            onClick={toggleMute}
            ariaLabel={muted ? c.unmute : c.mute}
          >
            {muted ? (
              <SpeakerSimpleSlash size={19} weight="fill" />
            ) : (
              <SpeakerSimpleHigh size={19} weight="regular" />
            )}
          </StudioButton>
          <ThemeToggle iconSize={18} quiet />
          <LanguageToggle iconSize={18} quiet />
        </div>
      </motion.div>
    </div>
  );
}
