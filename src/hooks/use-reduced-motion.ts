"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Subscribes to the OS "reduce motion" preference and re-renders when it
 * changes mid-session. The meters and the scene read this to stop their rAF
 * loops; reading `matchMedia(...).matches` once at mount (the old pattern)
 * silently kept animating if the user toggled the preference while the page
 * was open. SSR-safe: returns false on the server and reconciles on mount.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(QUERY);
    setReduced(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
