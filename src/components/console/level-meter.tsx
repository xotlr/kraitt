"use client";

import { useEffect, useRef, useState } from "react";
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
const IDLE_OPACITY = 0.28;

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

  // Tactile grab state: while the fader is being dragged (pointer down /
  // keyboard focus-active), the cap depresses into the slot and its drop
  // shadow tightens — the difference between a knob you can grab and a
  // shape painted on the panel.
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    // Idle / reduced-motion: park the ladder at its dim-but-readable rest
    // state (the segment structure + zone colours still show, like an
    // unlit LED meter on a powered desk) and the peak tick at the floor.
    const parkDark = () => {
      segRefs.current.forEach((el) => {
        if (!el) return;
        el.style.opacity = String(IDLE_OPACITY);
        el.style.filter = "none";
        el.style.boxShadow = "none";
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
        const lit = pos >= segPos;
        el.style.opacity = lit ? "1" : String(IDLE_OPACITY);
        // Lit segments read as emissive LEDs: brighten the colour and add a
        // tight coloured halo so they pop out of the recessed black window.
        // Unlit segments are flat (no glow) so only the live level glows.
        if (lit) {
          el.style.filter = "brightness(1.5) saturate(1.15)";
          el.style.boxShadow = "0 0 5px currentColor, 0 0 2px currentColor";
        } else {
          el.style.filter = "none";
          el.style.boxShadow = "none";
        }
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

  // Cap geometry (px). The slot's travel runs between PAD at top/bottom,
  // so the cap centre moves within (100% - 2*PAD); we offset by half the
  // cap height to centre it on the value.
  const CAP_H = 14;
  const SLOT_PAD = 6;

  return (
    <div
      ref={rootRef}
      className="channel-strip relative h-full w-full"
      style={
        {
          "--meter-green": "#5ec27a",
          "--meter-amber": "#d8a23a",
          "--meter-red": "#e0524e",
        } as React.CSSProperties
      }
    >
      {/* ── FACEPLATE ───────────────────────────────────────────────────
          A near-black machined plate the fader + meter are MOUNTED INTO.
          Defined by edge-lit hairlines (top highlight, bottom shade) over
          a graphite fill barely lifted off true black, so it reads as dark
          anodized metal without leaving the OLED-black brand. Two screws
          at top/bottom sell it as a bolted-on panel. */}
      <div
        className="absolute inset-0 flex gap-1 rounded-[8px] px-1.5 py-2.5"
        style={{
          // Graphite, just off black, with a faint top→bottom sheen.
          background:
            "linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 7%, var(--color-canvas)) 0%, var(--color-canvas) 55%, color-mix(in srgb, var(--color-ink) 4%, var(--color-canvas)) 100%)",
          boxShadow: [
            // top edge highlight + bottom edge shade = machined bevel
            "inset 0 1px 0 color-mix(in srgb, white 7%, transparent)",
            "inset 0 -1px 0 color-mix(in srgb, black 40%, transparent)",
            "0 0 0 1px var(--color-hairline)",
            // soft lift off the bezel so the plate sits proud
            "0 2px 6px color-mix(in srgb, black 35%, transparent)",
          ].join(","),
        }}
      >
        {/* Panel screws — top + bottom, centered on the plate. */}
        <Screw className="absolute left-1/2 top-1 -translate-x-1/2" />
        <Screw className="absolute left-1/2 bottom-1 -translate-x-1/2" />

        {/* ── FADER ─────────────────────────────────────────────────────
            A routed slot cut into the plate with a real molded cap riding
            in it. The cap is the set volume; a unity (0 dB) mark sits at
            75% travel (conventional 0 dB on a +6..-∞ taper). */}
        <div
          className="relative h-full shrink-0"
          style={{ width: "14px", marginTop: "8px", marginBottom: "8px" }}
        >
          {/* Routed slot — a deep recessed channel. Dark fill + strong inset
              shadow on all sides reads as a groove milled into the plate. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 rounded-full"
            style={{
              width: "6px",
              background:
                "linear-gradient(180deg, color-mix(in srgb, black 55%, transparent), color-mix(in srgb, black 35%, transparent))",
              boxShadow: [
                "inset 0 0 0 1px color-mix(in srgb, black 50%, transparent)",
                "inset 0 2px 3px color-mix(in srgb, black 65%, transparent)",
                "inset 0 -1px 1px color-mix(in srgb, white 5%, transparent)",
              ].join(","),
            }}
          />
          {/* Unity (0 dB) mark — a hairline tick beside the slot at 75%. */}
          <div
            aria-hidden
            className="absolute left-0 right-0"
            style={{
              bottom: `calc(${SLOT_PAD}px + 0.75 * (100% - ${SLOT_PAD * 2}px))`,
              height: "1px",
              background: "color-mix(in srgb, white 14%, transparent)",
            }}
          />
          {/* The molded cap — rides in the slot. Top highlight + side
              shading + a grip indent line read as a thumbed fader knob; a
              drop shadow seats it ABOVE the plate and IN the slot. On grab
              it depresses (translateY) and the shadow tightens. */}
          <div
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 rounded-[3px]"
            style={{
              width: "14px",
              height: `${CAP_H}px`,
              bottom: `calc(${volume} * (100% - ${SLOT_PAD * 2}px) + ${SLOT_PAD}px - ${CAP_H / 2}px)`,
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 92%, transparent) 0%, color-mix(in srgb, var(--color-ink) 70%, transparent) 45%, color-mix(in srgb, var(--color-ink) 82%, transparent) 100%)",
              boxShadow: grabbed
                ? [
                    "inset 0 1px 0 color-mix(in srgb, white 30%, transparent)",
                    "inset 0 -1px 0 color-mix(in srgb, black 35%, transparent)",
                    "0 1px 1px color-mix(in srgb, black 55%, transparent)",
                  ].join(",")
                : [
                    "inset 0 1px 0 color-mix(in srgb, white 45%, transparent)",
                    "inset 0 -1px 0 color-mix(in srgb, black 30%, transparent)",
                    "0 2px 3px color-mix(in srgb, black 55%, transparent)",
                  ].join(","),
              transform: grabbed ? "translateY(0.5px)" : "translateY(0)",
              transition: "bottom 90ms linear, box-shadow 120ms, transform 120ms",
            }}
          >
            {/* centre grip indent — the molded line you'd thumb */}
            <div
              className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                width: "9px",
                height: "2px",
                background: "color-mix(in srgb, black 45%, transparent)",
                boxShadow: "0 1px 0 color-mix(in srgb, white 30%, transparent)",
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
            onPointerDown={() => setGrabbed(true)}
            onPointerUp={() => setGrabbed(false)}
            onPointerCancel={() => setGrabbed(false)}
            onFocus={() => setGrabbed(true)}
            onBlur={() => setGrabbed(false)}
            aria-label="Lautstärke (Fader)"
            className="fader-input absolute inset-0 h-full w-full cursor-ns-resize"
          />
        </div>

        {/* ── METER ─────────────────────────────────────────────────────
            A recessed WINDOW cut into the plate, holding the segmented
            dBFS ladder. The printed scale OVERLAYS the window's right edge
            (absolute, no flex width) so the ladder keeps the full meter
            width even at one-button rail width. Passive — displays the
            live signal, sets nothing. */}
        <div
          className="relative flex h-full flex-1 flex-col-reverse gap-[2px] overflow-hidden rounded-[4px] p-[3px]"
          style={{
            background:
              "linear-gradient(180deg, color-mix(in srgb, black 50%, transparent), color-mix(in srgb, black 32%, transparent))",
            boxShadow: [
              "inset 0 0 0 1px color-mix(in srgb, black 55%, transparent)",
              "inset 0 2px 3px color-mix(in srgb, black 55%, transparent)",
              "inset 0 -1px 0 color-mix(in srgb, white 5%, transparent)",
            ].join(","),
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
                  // color drives currentColor for the lit-segment halo.
                  color: zoneColor(segDb),
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

          {/* Printed dBFS scale — overlaid down the window's right edge,
              right-aligned, with a subtle shadow so the digits read over
              the lit segments. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-[3px] right-[2px] flex flex-col justify-between"
          >
            {SCALE_TICKS.map((db) => (
              <span
                key={db}
                className="font-mono leading-none"
                style={{
                  fontSize: "5px",
                  letterSpacing: "0.01em",
                  color: "color-mix(in srgb, var(--color-ink) 65%, transparent)",
                  textShadow: "0 0 2px rgba(0,0,0,0.9), 0 0 1px rgba(0,0,0,0.9)",
                }}
              >
                {db === FLOOR_DB ? "-∞" : db}
              </span>
            ))}
          </div>
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
          height: ${CAP_H}px;
          background: transparent;
          cursor: ns-resize;
        }
        .fader-input::-moz-range-thumb {
          width: 100%;
          height: ${CAP_H}px;
          border: none;
          background: transparent;
          cursor: ns-resize;
        }
      `}</style>
    </div>
  );
}

/** A small recessed panel screw — sells the faceplate as bolted-on. */
function Screw({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none ${className ?? ""}`}
      style={{
        width: "4px",
        height: "4px",
        borderRadius: "9999px",
        background:
          "radial-gradient(circle at 50% 35%, color-mix(in srgb, var(--color-ink) 30%, var(--color-canvas)), color-mix(in srgb, black 60%, var(--color-canvas)))",
        boxShadow:
          "inset 0 0.5px 0.5px color-mix(in srgb, black 60%, transparent), 0 0.5px 0 color-mix(in srgb, white 8%, transparent)",
      }}
    />
  );
}
