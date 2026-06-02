"use client";

import { useEffect, useRef } from "react";
import { useAudio, useAudioLevels } from "@/lib/audio";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { sampleRamp, rgbString } from "@/lib/utils";

/**
 * SpectrumEq — three live columns (LO / MID / HI) driven by the SAME analyser
 * bands that drive the scene (levelsRef.bass/mid/high). Not a decorative loop:
 * it reads the real reactive band energy every frame.
 *
 * Colour is the SCENE palette, smoothly interpolated up each column (no hard
 * zone cuts): cold blue → purple-blue → silver → gold peak. The VOLUME level
 * (the handle riding across the EQ) acts as a ceiling — segments ABOVE the set
 * volume render DISABLED (desaturated + dark), so the EQ reads as "active up to
 * the level you set, dimmed above it", rather than lighting the full height.
 *
 * Driven on rAF via direct style writes (no React re-render per frame).
 */

const SEGMENTS = 24;
const BANDS = ["LO", "MID", "HI"] as const;
const IDLE_OPACITY = 0.14;

// Column colour is the shared INTENSITY_RAMP (see lib/utils) sampled up each
// column via `sampleRamp` — the same palette the fader, the scene, and the lit
// buttons speak. Disabled tone — the desaturated dark grey-blue the above-ceiling
// segments sink to — is local to the EQ.
const DISABLED: [number, number, number] = [0x33, 0x37, 0x40];

/** Blend two RGB tuples (used to sink ramp colours toward DISABLED). */
function lerpRGB(
  c1: readonly [number, number, number],
  c2: readonly [number, number, number],
  t: number
): [number, number, number] {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}

// Each segment's full-colour ramp value (its position up the column). Constant
// across all renders, so it lives at module scope — keeping it in the component
// re-created the array every render and re-subscribed the rAF effect.
const baseColors = Array.from({ length: SEGMENTS }, (_, i) =>
  sampleRamp(i / (SEGMENTS - 1))
);

export function SpectrumEq() {
  const levels = useAudioLevels();
  const { musicOn, micOn, volume } = useAudio();
  const active = musicOn || micOn;
  const reduce = useReducedMotion();

  // segRefs[band][segment]
  const segRefs = useRef<(HTMLDivElement | null)[][]>([[], [], []]);
  // Latest volume, read inside the rAF loop without re-subscribing the effect.
  const volRef = useRef(volume);
  volRef.current = volume;

  useEffect(() => {

    // Apply the volume-ceiling "disabled" look to a segment: above the ceiling
    // it desaturates toward DISABLED and dims; below it keeps its ramp colour.
    const paintCeiling = (lit: boolean) => {
      for (let b = 0; b < 3; b++) {
        const col = segRefs.current[b];
        for (let i = 0; i < col.length; i++) {
          const el = col[i];
          if (!el) continue;
          const segPos = i / (col.length - 1);
          const disabled = segPos > volRef.current + 0.001;
          const base = baseColors[i];
          const color = disabled ? rgbString(lerpRGB(base, DISABLED, 0.85)) : rgbString(base);
          el.style.background = color;
          el.style.color = color;
          if (!lit) {
            // idle: just the structure, dimmer when disabled
            el.style.opacity = String(disabled ? IDLE_OPACITY * 0.6 : IDLE_OPACITY);
            el.style.filter = "none";
            el.style.boxShadow = "none";
          }
        }
      }
    };

    if (!active || reduce) {
      paintCeiling(false);
      return;
    }

    let raf = 0;
    const disp = [0, 0, 0]; // smoothed per-band level

    const tick = () => {
      const a = levels.current;
      // Honest per-band ENERGY (bassLevel/midLevel/highLevel), NOT the reactive
      // bass/mid/high. The reactive values subtract a ~5s rolling baseline, so
      // a sustained loud track sank the bars to ~10% after a few seconds; these
      // stay up with the music. Already gained + smoothed in the engine; a light
      // extra one-pole here just cleans frame jitter.
      const raw = [a.bassLevel, a.midLevel, a.highLevel];
      const vol = volRef.current;
      for (let b = 0; b < 3; b++) {
        const target = Math.min(1, raw[b]);
        disp[b] += (target - disp[b]) * (target > disp[b] ? 0.6 : 0.12);
        const col = segRefs.current[b];
        for (let i = 0; i < col.length; i++) {
          const el = col[i];
          if (!el) continue;
          const segPos = i / (col.length - 1);
          const disabled = segPos > vol + 0.001;
          const base = baseColors[i];
          // Above the volume ceiling: disabled (desaturated + dark), never
          // lights regardless of signal. Below: lights by the band level.
          if (disabled) {
            const color = rgbString(lerpRGB(base, DISABLED, 0.85));
            el.style.background = color;
            el.style.color = color;
            el.style.opacity = String(IDLE_OPACITY * 0.6);
            el.style.filter = "none";
            el.style.boxShadow = "none";
            continue;
          }
          const color = rgbString(base);
          el.style.background = color;
          el.style.color = color;
          const lit = disp[b] >= segPos;
          el.style.opacity = lit ? "1" : String(IDLE_OPACITY);
          if (lit) {
            el.style.filter = "brightness(1.25)";
            el.style.boxShadow = "0 0 4px currentColor";
          } else {
            el.style.filter = "none";
            el.style.boxShadow = "none";
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels, active, reduce]);

  return (
    <div
      aria-hidden
      // Recessed window shared with the VU dial (.console-recess-window) —
      // theme-softened in light mode so the bar isn't a dark well with a hard
      // black border fighting the navpills.
      className="console-recess-window flex h-full w-full gap-[3px] rounded-[7px] p-[3px]"
    >
      {BANDS.map((band, b) => (
        <div key={band} className="flex flex-1 flex-col items-center gap-[2px]">
          <div className="flex flex-1 w-full flex-col-reverse gap-[2px]">
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <div
                key={i}
                ref={(el) => {
                  segRefs.current[b][i] = el;
                }}
                className="w-full flex-1 rounded-[2px] transition-[opacity,background-color,filter] duration-150"
                style={{
                  background: rgbString(baseColors[i]),
                  color: rgbString(baseColors[i]),
                  opacity: IDLE_OPACITY,
                  minHeight: "1.5px",
                }}
              />
            ))}
          </div>
          {/* Band legend — silkscreen under each column. */}
          <span
            className="font-mono leading-none"
            style={{
              fontSize: "5.5px",
              letterSpacing: "0.06em",
              color: "var(--console-print)",
            }}
          >
            {band}
          </span>
        </div>
      ))}
    </div>
  );
}
