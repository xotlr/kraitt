"use client";

import { useEffect, useRef } from "react";
import { useAudio, useAudioLevels } from "@/lib/audio";

/**
 * ChannelStrip — a real console channel strip, not a grey volume bar.
 *
 * Two separate objects, the way a working engineer expects them:
 *
 *   ┌────────┬───────┐
 *   │ FADER  │ METER │
 *   │  ▢ cap │ ▰ 0   │  ← dBFS ladder, segmented
 *   │  │     │ ▰ -6  │     green ≤ -18, amber -18..-6, red > -6
 *   │  │     │ ▰ -12 │     peak-hold tick falls back slowly
 *   │  │  U  │ ▰ -18 │  ← U = unity (0 dB) mark on the fader taper
 *   │  │     │ ▰ -24 │
 *   │  │     │ ▱ -∞  │
 *   └────────┴───────┘
 *
 * The FADER sets playback volume (drag the cap). The METER is a passive
 * dBFS display of the live signal — it does not set anything.
 *
 * Honesty note: the shared audio level is a reactive 0..1 value (energy
 * above a rolling baseline), not a calibrated dBFS sample. We map it onto
 * a dBFS scale so the meter reads with real engineering vocabulary — the
 * scale gives the moving needle meaning — but it is a visual mapping, not
 * a metrologically exact peak meter. Floor is -48 dBFS; 1.0 maps to 0 dBFS.
 */

// Meter scale. Top of the ladder is 0 dBFS, floor is FLOOR_DB. Segment
// boundaries and the colour zones below are quoted in dBFS so they line
// up with the printed scale labels.
const FLOOR_DB = -48;
const SEGMENTS = 16; // LED-style segment count on the ladder
// Scale ticks we actually print next to the ladder (dBFS).
const SCALE_TICKS = [0, -6, -12, -18, -24, -36, -48];
// Colour-zone boundaries (dBFS): red above RED_DB, amber down to AMBER_DB,
// green below. -6 / -18 are conventional broadcast-ish guides.
const RED_DB = -6;
const AMBER_DB = -18;
// Rest brightness of an unlit segment. High enough that the ladder
// structure + colour zones read at idle (a real LED meter's segments are
// visible unlit), low enough that lit segments clearly pop above it.
const IDLE_OPACITY = 0.2;

/** Map a 0..1 reactive level to dBFS on our floor..0 scale. */
function levelToDb(level: number): number {
  if (level <= 0) return FLOOR_DB;
  // 20*log10 with the 0..1 value treated as linear amplitude. Clamp to the
  // floor so silence parks at the bottom rather than -Infinity.
  const db = 20 * Math.log10(Math.min(1, level));
  return Math.max(FLOOR_DB, db);
}

/** dBFS → 0..1 position up the ladder (0 = floor, 1 = 0 dBFS). */
function dbToPos(db: number): number {
  return (db - FLOOR_DB) / (0 - FLOOR_DB);
}

function zoneColor(db: number): string {
  if (db > RED_DB) return "var(--meter-red)";
  if (db > AMBER_DB) return "var(--meter-amber)";
  return "var(--meter-green)";
}

export function ChannelStrip() {
  const levels = useAudioLevels();
  const { volume, setVolume, musicOn, micOn } = useAudio();
  const active = musicOn || micOn;

  // One container; children driven by CSS vars written on rAF so the
  // ladder + peak tick animate at 60fps with zero React re-render.
  const rootRef = useRef<HTMLDivElement>(null);
  const segRefs = useRef<(HTMLDivElement | null)[]>([]);
  const peakRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Idle / reduced-motion: park the ladder at its dim-but-readable rest
    // state (the segment structure + zone colours still show, like an
    // unlit LED meter on a powered desk) and the peak tick at the floor.
    const parkDark = () => {
      segRefs.current.forEach((el) => {
        if (el) el.style.opacity = String(IDLE_OPACITY);
      });
      if (peakRef.current) peakRef.current.style.bottom = "0%";
    };

    if (!active || reduce) {
      parkDark();
      return;
    }

    let raf = 0;
    let lvl = 0; // smoothed displayed level (linear 0..1)
    let peakDb = FLOOR_DB; // held peak in dBFS
    let peakHoldFrames = 0; // frames remaining before the peak starts to fall

    const tick = () => {
      const a = levels.current;
      // Programme level: bass-weighted with a little high for transients —
      // matches what drives the rest of the scene.
      const drive = Math.min(1, a.bass * 0.9 + a.high * 0.35);
      // Peak-meter ballistics: fast attack, slow release.
      lvl += (drive - lvl) * (drive > lvl ? 0.5 : 0.09);

      const db = levelToDb(lvl);
      const pos = dbToPos(db); // 0..1 up the ladder

      // Light each segment whose threshold the current level has reached,
      // coloured by the zone its OWN threshold sits in (so the red segments
      // are always red, lit or not).
      const segs = segRefs.current;
      for (let i = 0; i < segs.length; i++) {
        const el = segs[i];
        if (!el) continue;
        // Segment i spans [i/N, (i+1)/N] of the ladder; lit if the level
        // reaches its lower edge.
        const segPos = i / (segs.length - 1);
        el.style.opacity = pos >= segPos ? "1" : String(IDLE_OPACITY);
      }

      // Peak hold: capture new peaks instantly, hold ~700ms, then fall.
      if (db >= peakDb) {
        peakDb = db;
        peakHoldFrames = 42; // ~0.7s at 60fps
      } else if (peakHoldFrames > 0) {
        peakHoldFrames--;
      } else {
        // Fall back at ~0.5 dB/frame.
        peakDb = Math.max(FLOOR_DB, peakDb - 0.5);
      }
      if (peakRef.current) {
        const peakPos = dbToPos(peakDb);
        peakRef.current.style.bottom = `${(peakPos * 100).toFixed(1)}%`;
        peakRef.current.style.background = zoneColor(peakDb);
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels, active]);

  return (
    <div
      ref={rootRef}
      className="channel-strip flex h-full w-full gap-1.5"
      style={
        {
          "--meter-green": "#5ec27a",
          "--meter-amber": "#d8a23a",
          "--meter-red": "#e0524e",
        } as React.CSSProperties
      }
    >
      {/* ── FADER ──────────────────────────────────────────────────────
          A thin recessed track with a real draggable cap. The cap is the
          set volume; a faint unity (0 dB) mark sits at 75% of travel, the
          conventional position of a fader's 0 dB on a taper that runs
          +6 at the top to -∞ at the bottom. */}
      <div className="relative h-full" style={{ width: "13px" }}>
        {/* Track slot */}
        <div
          aria-hidden
          className="absolute left-1/2 top-1 bottom-1 -translate-x-1/2 rounded-full"
          style={{
            width: "3px",
            background: "color-mix(in srgb, var(--color-ink) 14%, transparent)",
            boxShadow:
              "inset 0 0 0 1px var(--color-hairline), inset 0 1px 2px color-mix(in srgb, var(--color-ink) 25%, transparent)",
          }}
        />
        {/* Unity (0 dB) mark — a hairline notch at 75% of fader travel,
            the conventional 0 dB position on a +6..-∞ taper. */}
        <div
          aria-hidden
          className="absolute left-0 right-0"
          style={{
            bottom: "calc(0.25rem + 0.75 * (100% - 0.5rem))",
            height: "1px",
            background: "var(--color-hairline-hover)",
          }}
        />
        {/* Filled portion below the cap — quiet ink so the set level reads. */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-full"
          style={{
            width: "3px",
            bottom: "0.25rem",
            height: `calc(${volume} * (100% - 0.5rem))`,
            background: "color-mix(in srgb, var(--color-ink) 34%, transparent)",
            transition: "height 90ms linear",
          }}
        />
        {/* The cap — the draggable fader knob. */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 rounded-[3px]"
          style={{
            width: "13px",
            height: "7px",
            bottom: `calc(${volume} * (100% - 0.5rem) + 0.25rem - 3.5px)`,
            background: "var(--color-ink)",
            boxShadow:
              "0 1px 2px color-mix(in srgb, var(--color-ink) 45%, transparent), inset 0 1px 0 color-mix(in srgb, white 35%, transparent)",
            transition: "bottom 90ms linear",
          }}
        >
          {/* grip line across the cap */}
          <div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              width: "7px",
              height: "1px",
              background: "var(--color-canvas)",
              opacity: 0.5,
            }}
          />
        </div>
        {/* Invisible vertical range over the whole fader. */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          aria-label="Lautstärke (Fader)"
          className="fader-input absolute inset-0 h-full w-full cursor-ns-resize"
        />
      </div>

      {/* ── METER ──────────────────────────────────────────────────────
          A segmented dBFS ladder with a held peak tick and printed scale.
          Passive: it displays the live signal, it does not set anything. */}
      <div className="relative h-full flex-1">
        {/* Ladder housing — recessed black so dark segments read as 'off'. */}
        <div
          className="absolute inset-y-0 left-0 flex flex-col-reverse gap-[2px] overflow-hidden rounded-[5px] p-[3px]"
          style={{
            right: "16px", // leave room for the scale labels on the right
            background: "color-mix(in srgb, var(--color-ink) 6%, transparent)",
            boxShadow: "inset 0 0 0 1px var(--color-hairline)",
          }}
        >
          {Array.from({ length: SEGMENTS }).map((_, i) => {
            // Each segment's dBFS threshold = its position on the floor..0
            // scale, so we can colour it by zone.
            const segDb = FLOOR_DB + ((i + 1) / SEGMENTS) * (0 - FLOOR_DB);
            return (
              <div
                key={i}
                ref={(el) => {
                  segRefs.current[i] = el;
                }}
                className="w-full flex-1 rounded-[1.5px] transition-opacity duration-75"
                style={{
                  background: zoneColor(segDb),
                  opacity: IDLE_OPACITY,
                  minHeight: "2px",
                }}
              />
            );
          })}

          {/* Peak-hold tick — a bright line riding the held peak. */}
          <div
            ref={peakRef}
            aria-hidden
            className="pointer-events-none absolute left-[3px] right-[3px] h-[2px]"
            style={{ bottom: "0%", background: "var(--meter-green)" }}
          />
        </div>

        {/* Printed dBFS scale — mono ticks down the right edge. */}
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 flex flex-col justify-between"
          style={{ width: "15px" }}
        >
          {SCALE_TICKS.map((db) => (
            <span
              key={db}
              className="font-mono leading-none text-ink-faint"
              style={{
                fontSize: "5.5px",
                letterSpacing: "0.02em",
              }}
            >
              {db === FLOOR_DB ? "-∞" : db}
            </span>
          ))}
        </div>
      </div>

      <style jsx>{`
        .fader-input {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          writing-mode: vertical-lr;
          direction: rtl;
        }
        .fader-input:focus {
          outline: none;
        }
        .fader-input::-webkit-slider-runnable-track,
        .fader-input::-moz-range-track {
          background: transparent;
        }
        .fader-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: 7px;
          background: transparent;
          cursor: ns-resize;
        }
        .fader-input::-moz-range-thumb {
          width: 100%;
          height: 7px;
          border: none;
          background: transparent;
          cursor: ns-resize;
        }
      `}</style>
    </div>
  );
}
