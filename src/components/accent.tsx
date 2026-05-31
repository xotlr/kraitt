"use client";

import { useEffect, useRef } from "react";
import { useScramble } from "@/hooks/use-scramble";

/**
 * Accent — the bracketed amber emphasis word, with a "decrypting telemetry
 * field" scramble on reveal + hover.
 *
 * Visually identical to the old `<span className="text-accent audio-accent">`
 * it replaces: the [ ] brackets are CSS pseudo-elements on .text-accent (so they
 * stay PERFECTLY STILL — a fixed readout frame), the amber colour + audio bloom
 * come from .audio-accent, and only the CONTENT between the brackets scrambles.
 *
 * Motion runs on:
 *   - reveal: once, when the word first scrolls into view (IntersectionObserver)
 *   - hover:  every time the pointer enters
 * and is otherwise fully idle (no rAF, no timers). Reduced-motion → static word.
 *
 * The real text is always in the DOM for SSR + screen readers; useScramble only
 * mutates textContent for the duration of an animation.
 */
export function Accent({ children }: { children: string }) {
  const { ref, play } = useScramble<HTMLSpanElement>(children);
  const played = useRef(false);

  // Reveal trigger: fire the scramble once, the first time the span enters the
  // viewport. Uses the same scroll viewport the sections animate against; a
  // null root observes against the document/closest scroll container.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting && !played.current) {
            played.current = true;
            play();
            io.disconnect();
          }
        }
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, play]);

  return (
    <span
      ref={ref}
      className="text-accent audio-accent"
      onMouseEnter={play}
    >
      {children}
    </span>
  );
}
