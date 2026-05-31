"use client";

import { useCallback, useEffect, useState } from "react";
import { SECTIONS } from "@/components/console/controls";
import { useAudio } from "@/lib/audio";
import { useScrollViewport, useScrollTo } from "@/lib/scroll-context";

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
    const root = viewportRef.current;
    if (!root) return;
    // No rAF: IntersectionObserver already defers its first callback, and
    // the section elements exist by the time this effect runs. Observing
    // synchronously means the disconnect below always tears every observer
    // down, even on a same-tick unmount.
    const observers = SECTIONS.map((s) => {
      const el = document.getElementById(s.id);
      if (!el) return null;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(s.id);
        },
        { root, rootMargin: "-40% 0px -55% 0px", threshold: 0 }
      );
      obs.observe(el);
      return obs;
    });
    return () => observers.forEach((o) => o?.disconnect());
  }, [viewportRef]);

  return active;
}

/**
 * useSectionNav — the shared nav behaviour for the desktop rail AND the mobile
 * panel: the active-section value plus a click handler that scrolls to a
 * section and, when no audio source is playing, fires a manual wave pulse so a
 * section press visibly drives the signal in silence. Both consoles used to
 * inline an identical `handleSection` closure; this is the single source.
 */
export function useSectionNav() {
  const active = useActiveSection();
  const scrollTo = useScrollTo();
  const { musicOn, micOn, triggerPulse } = useAudio();
  const audioOff = !musicOn && !micOn;

  const handleSection = useCallback(
    (id: string): React.MouseEventHandler<HTMLButtonElement> =>
      (e) => {
        if (audioOff) triggerPulse();
        scrollTo(id)(e);
      },
    [audioOff, triggerPulse, scrollTo]
  );

  return { active, handleSection };
}
