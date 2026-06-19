"use client";

import { useFrame } from "@react-three/fiber";
import { useRef, type RefObject } from "react";
import { useTheme } from "@/lib/theme-context";

/**
 * useThemeMix — the shared 0→1 eased theme transition both scene shaders read.
 *
 * terrain.tsx and atmosphere.tsx each used to carry an identical `themeMix`
 * ref + per-frame `+= (target - cur) * 0.08` lerp (a ~450ms settle at 60fps,
 * matched to the CSS @property token transition so the scene morphs in sync
 * with the page chrome rather than snapping). This is that, once.
 *
 * It owns the eased scalar in a ref and advances it every frame, returning the
 * ref. The caller reads `mix.current` in its OWN useFrame to drive its uniform
 * (and, in terrain's case, a fog colour lerped off the same value). We keep the
 * uniform write in the caller — where the uniforms are a local useMemo — rather
 * than mutating a passed-in node here, so the eased value has exactly one
 * owner and there's no cross-hook mutation.
 *
 * NOTE on the frame cap: like every other fixed-coefficient ease in the scene,
 * this settles proportionally slower at the 30/20fps cap — the accepted trade
 * documented in CLAUDE.md §3.
 */
export function useThemeMix(): RefObject<number> {
  const { theme } = useTheme();
  const mix = useRef(0);

  useFrame(() => {
    const target = theme === "light" ? 1 : 0;
    mix.current += (target - mix.current) * 0.08;
  });

  return mix;
}
