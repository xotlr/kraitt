"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";

/**
 * FrameCap — throttles the render loop to a target FPS.
 *
 * The Canvas runs `frameloop="demand"` (it only renders when something calls
 * invalidate()). This component is the single thing calling invalidate, on a
 * self-correcting timer pinned to `fps`. The result is a hard cap: the GPU
 * does ~30 (desktop) or ~20 (mobile) frames a second instead of the monitor's
 * native 60–120, which is the dominant cost on the page.
 *
 * r3f derives each frame's `delta` from real elapsed time between renders, so
 * useFrame physics that multiply by `delta` stay correct at any cap. Eases
 * written with fixed per-frame coefficients (e.g. `x += (t - x) * 0.08`) settle
 * proportionally slower at a lower cap — an accepted, subtle trade for halving
 * GPU/battery cost. (CLAUDE.md §3 — previously NOT ENFORCED.)
 *
 * When `fps` is null the cap is disabled and the component does nothing (the
 * Canvas is expected to be in "demand" for reduced-motion / hidden-tab, where
 * a single static frame is desired and no pump should run).
 */
export function FrameCap({ fps }: { fps: number | null }) {
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (fps === null) return;
    const interval = 1000 / fps;
    let raf = 0;
    let last = performance.now();

    const pump = (now: number) => {
      raf = requestAnimationFrame(pump);
      // Only render once a full interval has elapsed. Carry the remainder so
      // the average rate stays on target rather than drifting toward the
      // monitor's refresh (which would happen if we reset `last` to `now`).
      const elapsed = now - last;
      if (elapsed >= interval) {
        last = now - (elapsed % interval);
        invalidate();
      }
    };
    raf = requestAnimationFrame(pump);
    return () => cancelAnimationFrame(raf);
  }, [fps, invalidate]);

  return null;
}
