"use client";

import { useEffect, useRef } from "react";
import { useAudio, useAudioLevels } from "@/lib/audio";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

/**
 * VuMeter — a dry, modular needle meter. NOT a cream vintage VU: it's cut from
 * the same graphite/recess language as the rest of the strip — a dark recessed
 * window with a thin bright needle sweeping an arc whose colour follows the
 * meter zones (green → amber → red). So it matches the console's palette and
 * reads as part of the same instrument, not a skeuomorphic antique pasted on.
 *
 * Accuracy: the needle tracks the honest post-fade RMS programme level
 * (`levels.current.rms`) — a true full-band RMS scaled by the fader, with
 * ~300ms symmetric VU ballistics already applied in the audio engine. So the
 * needle reads real LOUDNESS and answers to the volume fader: ride the fader
 * down and the needle falls. (The bass/mid/high reactive values still drive
 * the shader + EQ; the meter deliberately does not use them — a beat-reactive
 * value is wrong for a loudness meter.)
 *
 * rAF-driven via a direct transform + colour write (no React re-render per
 * frame). Idle/reduced-motion: needle parks at rest (hard left).
 */

const MIN_DEG = -52;
const MAX_DEG = 52;

export function VuMeter() {
  const levels = useAudioLevels();
  const { musicOn, micOn } = useAudio();
  const active = musicOn || micOn;
  const reduce = useReducedMotion();
  const needleRef = useRef<SVGGElement>(null);
  const needleLineRef = useRef<SVGLineElement>(null);

  useEffect(() => {
    const park = () => {
      if (needleRef.current) {
        // SVG transform attribute, pivoting natively around (50,50) — see note
        // at the <g> for why this isn't a CSS transform.
        needleRef.current.setAttribute("transform", `rotate(${MIN_DEG} 50 50)`);
      }
    };

    if (!active || reduce) {
      park();
      return;
    }

    let raf = 0;
    let v = 0;
    const tick = () => {
      const a = levels.current;
      // Honest post-fade loudness — ballistics already applied upstream. A
      // light extra one-pole only cleans residual frame jitter; the real
      // 300ms VU integration lives in the engine.
      const drive = Math.min(1, a.rms);
      v += (drive - v) * 0.35;
      const deg = MIN_DEG + v * (MAX_DEG - MIN_DEG);
      if (needleRef.current) {
        needleRef.current.setAttribute(
          "transform",
          `rotate(${deg.toFixed(2)} 50 50)`
        );
      }
      // Needle colour follows the zone it's pointing into.
      if (needleLineRef.current) {
        const color =
          v > 0.85
            ? "var(--meter-red)"
            : v > 0.6
              ? "var(--meter-amber)"
              : "var(--meter-green)";
        needleLineRef.current.style.stroke = color;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels, active, reduce]);

  return (
    <div
      aria-hidden
      className="relative w-full overflow-hidden rounded-[6px]"
      style={{
        aspectRatio: "1.15 / 1",
        // Dark recessed window — same routed-black surface as the meter, so
        // the dial belongs to the same instrument.
        background:
          "linear-gradient(180deg, color-mix(in srgb, var(--console-recess) 70%, black), var(--console-recess))",
        boxShadow: [
          "inset 0 0 0 1px color-mix(in srgb, black 55%, transparent)",
          "inset 0 2px 4px color-mix(in srgb, black 65%, transparent)",
          "inset 0 -1px 0 color-mix(in srgb, white 4%, transparent)",
        ].join(","),
      }}
    >
      <svg
        viewBox="0 0 100 60"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Zone arc — the scale, coloured in meter zones. Three coloured
            segments along the sweep: green (safe), amber (approaching), red
            (hot). This IS the dial's calibration, in the console palette. */}
        <path
          d="M 18 50 A 36 36 0 0 1 49 14.2"
          fill="none"
          stroke="var(--meter-green)"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path
          d="M 51 14.2 A 36 36 0 0 1 71 21.5"
          fill="none"
          stroke="var(--meter-amber)"
          strokeWidth="2.4"
          opacity="0.6"
        />
        <path
          d="M 71 21.5 A 36 36 0 0 1 82 50"
          fill="none"
          stroke="var(--meter-red)"
          strokeWidth="2.4"
          strokeLinecap="round"
          opacity="0.7"
        />
        {/* Needle — pivots at the hub (50,50). We use the SVG `transform`
            ATTRIBUTE (rotate deg 50 50), NOT a CSS transform: CSS transform-box
            fill-box would make the origin relative to the line's own thin
            bounding box, so the needle slid around instead of pivoting on the
            hub. The attribute rotates natively around the given user-space
            point. A thin bright line; colour set per-frame to its zone. */}
        <g ref={needleRef} transform={`rotate(${MIN_DEG} 50 50)`}>
          <line
            ref={needleLineRef}
            x1="50"
            y1="50"
            x2="50"
            y2="16"
            stroke="var(--meter-green)"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </g>
        {/* Pivot hub — graphite, like a cap. */}
        <circle cx="50" cy="50" r="3" fill="var(--console-cap)" />
        <circle cx="50" cy="50" r="1.1" fill="var(--console-edge)" />
      </svg>
    </div>
  );
}
