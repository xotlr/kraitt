"use client";

import { useEffect, useRef } from "react";
import { useAudioLevels } from "@/lib/audio";

/**
 * useAudioGlow — drives an amber "beat glow" on DOM headings without
 * triggering React re-renders.
 *
 * The shader is the brand; the type frames it. So when audio plays, the
 * headings pick up the same warm pulse the wave field does — a faint
 * amber text-shadow that blooms on bass hits and fades. Amber only, no
 * movement: it stays type-led and cinematic rather than bouncy.
 *
 * Implementation: read the shared smoothed audio levels (the same ref
 * the shader reads) on a rAF loop and write a single CSS custom
 * property, --audio-glow (0..1), onto the target element. The CSS in
 * the component maps that to text-shadow intensity. Writing a CSS var
 * is a style mutation, not a React state change, so headings re-glow at
 * 60fps with zero reconciliation.
 *
 * Bass-weighted (the swell band) with a little high mixed in for sparkle
 * on transients. Decays on its own via the levels' asymmetric release.
 */
export function useAudioGlow<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const levels = useAudioLevels();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect reduced-motion: set a static zero and never animate.
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) {
      el.style.setProperty("--audio-glow", "0");
      return;
    }

    let raf = 0;
    let smoothed = 0;
    const tick = () => {
      const lv = levels.current;
      // Bass dominates (it's the beat); highs add a touch of shimmer.
      const target = Math.min(1, lv.bass * 0.85 + lv.high * 0.3);
      // Light smoothing so the glow doesn't strobe on noisy frames.
      smoothed += (target - smoothed) * 0.25;
      el.style.setProperty("--audio-glow", smoothed.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels]);

  return ref;
}
