"use client";

import { useCallback, useEffect, useRef } from "react";

// The glyph pool the field cycles through while resolving. Box-drawing + block
// shades read as a HUD/telemetry field decrypting (Death Stranding / NASA
// readout) rather than random ASCII noise; a few mono-friendly symbols add
// flicker without ever looking like real letters mid-resolve.
const GLYPHS = "█▓▒░#%&/\\<>=+*▌▐▆▍".split("");

// How long the whole word takes to settle, and the per-character stagger. Each
// character locks left-to-right: char i starts resolving at i*STAGGER and is
// done by i*STAGGER + SETTLE. Tuned so a short word ("film") resolves in ~0.5s
// and a longer phrase ("Raum zwischen") in ~0.9s — fast enough to read as a
// snap-resolve, slow enough to see the cycle.
const STAGGER_MS = 55;
const SETTLE_MS = 360;

function pick(prev: string): string {
  // Avoid repeating the same glyph twice in a row so the cycle reads as motion.
  let g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
  if (g === prev) g = GLYPHS[(Math.random() * GLYPHS.length) | 0];
  return g;
}

/**
 * useScramble — drives a "decrypting telemetry field" reveal on a text node.
 *
 * The element keeps its real text in the DOM (set by React) for accessibility
 * and SSR; this hook only MUTATES textContent during an animation, then restores
 * the real string when it finishes. So screen readers and no-JS get the real
 * word; sighted JS users get the scramble.
 *
 * Idle cost is ZERO: no rAF runs unless an animation is in flight. We start one
 * on `play()` (called on scroll-into-view, once, and on each hover) and tear it
 * down the instant the word is fully resolved. Honours reduced-motion by
 * never animating.
 *
 * Returns { ref, play }: put `ref` on the text element, call `play()` to trigger.
 */
export function useScramble<T extends HTMLElement>(text: string) {
  const ref = useRef<T>(null);
  const raf = useRef(0);
  const startRef = useRef(0);
  // The real string, kept in a ref so the rAF closure always restores the
  // current text even if the label changes (language switch) mid-life.
  const textRef = useRef(text);
  textRef.current = text;

  const reduceRef = useRef(false);
  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  const play = useCallback(() => {
    const el = ref.current;
    if (!el || reduceRef.current) return;
    const full = textRef.current;
    if (!full) return;

    cancelAnimationFrame(raf.current);
    startRef.current = performance.now();
    // Per-character last-glyph memory so each slot's cycle doesn't stutter.
    const prev: string[] = new Array<string>(full.length).fill("");

    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      let out = "";
      let done = true;
      for (let i = 0; i < full.length; i++) {
        const ch = full[i];
        // Preserve whitespace exactly — spaces never scramble (keeps multi-word
        // phrases like "Raum zwischen" readable as they resolve).
        if (ch === " ") {
          out += " ";
          continue;
        }
        const localStart = i * STAGGER_MS;
        const localEnd = localStart + SETTLE_MS;
        if (elapsed >= localEnd) {
          out += ch; // locked
        } else if (elapsed >= localStart) {
          prev[i] = pick(prev[i]);
          out += prev[i];
          done = false;
        } else {
          // Not started yet — show a cycling glyph so the field reads as "live"
          // ahead of the resolve front, not blank.
          prev[i] = pick(prev[i]);
          out += prev[i];
          done = false;
        }
      }
      el.textContent = out;
      if (done) {
        el.textContent = full; // guarantee exact final string
        raf.current = 0;
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  // On unmount, stop any in-flight animation and leave the real text in place.
  useEffect(() => {
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      const el = ref.current;
      if (el) el.textContent = textRef.current;
    };
  }, []);

  return { ref, play };
}
