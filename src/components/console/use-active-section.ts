"use client";

import { useEffect, useState } from "react";
import { SECTIONS } from "@/components/console/controls";
import { useScrollViewport } from "@/lib/scroll-context";

/**
 * useActiveSection — tracks which section is in view, observed against
 * the ScrollArea viewport (not the document). Extracted from the old
 * nav so the desktop rail and the mobile panel share one detector
 * instead of each running their own observer set.
 *
 * rootMargin "-40% 0px -55% 0px" = a section counts as active once it
 * occupies the middle ~5% band of the viewport, matching the original
 * top-nav behavior.
 */
export function useActiveSection(): string {
  const [active, setActive] = useState(SECTIONS[0].id);
  const viewportRef = useScrollViewport();

  useEffect(() => {
    let cleanup: (() => void) | null = null;
    const id = requestAnimationFrame(() => {
      const root = viewportRef.current;
      if (!root) return;
      const observers: IntersectionObserver[] = [];
      SECTIONS.forEach((s) => {
        const el = document.getElementById(s.id);
        if (!el) return;
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) setActive(s.id);
          },
          { root, rootMargin: "-40% 0px -55% 0px", threshold: 0 }
        );
        obs.observe(el);
        observers.push(obs);
      });
      cleanup = () => observers.forEach((o) => o.disconnect());
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup?.();
    };
  }, [viewportRef]);

  return active;
}
