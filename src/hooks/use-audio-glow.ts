"use client";

import { useEffect, useRef } from "react";
import { useAudioLevels } from "@/lib/audio";
import { INTENSITY_RAMP, intensityColor } from "@/lib/utils";

/**
 * useAudioGlow — drives an audio-reactive COLOUR on a DOM element without
 * triggering React re-renders.
 *
 * The shader is the brand; the type frames it. So when audio plays, headings
 * (and lit console buttons) SHIFT COLOUR along the desk's shared intensity ramp:
 * cold blue when the music is quiet, up through silver, to gold on a peak. Same
 * ramp the fader fill and EQ use (INTENSITY_RAMP), so "how intense" reads as one
 * colour language everywhere.
 *
 * This hook only PROVIDES the signal (a colour + a scalar); whether a consumer
 * also blooms is the consumer's call. The hero wordmark, for instance, drives a
 * tint-coloured text-shadow off --audio-glow so the type lights up as it warms
 * (see heroGlowStyle); the console LED reads the same scalar. Restrained and
 * cinematic, never a strobe.
 *
 * Each frame we read the shared smoothed audio levels (the same ref the shader
 * reads), map a bass-weighted intensity to a colour on the ramp, and write two
 * CSS custom properties onto the target element:
 *
 *   --audio-tint  : an rgb() colour sampled from the ramp at the current
 *                   intensity. Consumers set `color: var(--audio-tint, …)`.
 *                   CLEARED at silence so consumers fall back to their resting
 *                   colour (and any glow keyed off it fades to transparent).
 *   --audio-glow  : the raw 0..1 intensity, for callers that want a scalar —
 *                   the hero's bloom radius/opacity and the button LED ride it.
 *
 * Writing CSS vars is a style mutation, not a React state change, so elements
 * recolour at 60fps with zero reconciliation. Bass-weighted (the beat) with a
 * little high mixed in for sparkle on transients; decays on its own via the
 * levels' asymmetric release.
 */
export function useAudioGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const levels = useAudioLevels();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: pin to the low (cold) end and never animate.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      el.style.setProperty("--audio-glow", "0");
      el.style.setProperty("--audio-tint", intensityColor(0, INTENSITY_RAMP));
      return;
    }

    let raf = 0;
    let smoothed = 0;
    let lastTint = "";
    let tinted = false;
    // Below this the signal is effectively silence — we CLEAR --audio-tint so
    // consumers fall back to their resting colour (active buttons return to
    // gold, headings to ink) instead of freezing at the last cold-blue tint
    // when the music stops. Above it, the tint tracks live intensity.
    const SILENCE = 0.02;
    const tick = () => {
      const lv = levels.current;
      // Bass dominates (it's the beat); highs add a touch of shimmer.
      const target = Math.min(1, lv.bass * 0.85 + lv.high * 0.3);
      // Light smoothing so the colour doesn't strobe on noisy frames.
      smoothed += (target - smoothed) * 0.25;
      el.style.setProperty("--audio-glow", smoothed.toFixed(3));
      if (smoothed < SILENCE) {
        // Silence → hand colour back to the resting fallback.
        if (tinted) {
          el.style.removeProperty("--audio-tint");
          tinted = false;
          lastTint = "";
        }
      } else {
        // Only rewrite the colour when it actually changes — avoids
        // re-stringifying an identical rgb() every frame.
        const tint = intensityColor(smoothed, INTENSITY_RAMP);
        if (tint !== lastTint) {
          el.style.setProperty("--audio-tint", tint);
          lastTint = tint;
          tinted = true;
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels]);

  return ref;
}
