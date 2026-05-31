"use client";

import { useEffect, useRef, useState } from "react";
import { useScrollViewport } from "@/lib/scroll-context";
import { cn } from "@/lib/utils";

/**
 * A numeric measurement ruler that flanks the screen — the console's
 * calibration scale. Two of these frame the monitor (left + right); they
 * share the same fixed 00–100 graduations so they read row-for-row aligned,
 * and BOTH track live scroll position so the page reads as one instrument you
 * move through together.
 *
 * - Fixed major labels (00, 20, 40, 60, 80, 100) printed at evenly spaced
 *   rows, with minor ticks between — engraved, never moving.
 * - A live readout block rides to the current scroll %: on the right it's the
 *   draggable handle (pointer-events on), on the left it's a passive marker
 *   mirroring the same position (pointer-events off).
 *
 * Scroll is read off the ScrollArea viewport (not window — Radix scrolls a
 * child div), throttled to one rAF per scroll burst. No work runs when the
 * page isn't scrolling, so this respects the frame-budget gates.
 */

// Fixed scale labels, top (00) → bottom (100). The rows divide the track
// evenly; minor ticks fill the gaps via the .console-gauge background.
const LABELS = [0, 20, 40, 60, 80, 100] as const;

const fmt = (n: number) => String(Math.round(n)).padStart(2, "0");

export function ScrollGauge({
  side,
  draggable = false,
  onScrubStart,
}: {
  side: "left" | "right";
  /** Right gauge is interactive (drag to scrub); left is a passive mirror. */
  draggable?: boolean;
  onScrubStart?: () => void;
}) {
  const viewportRef = useScrollViewport();
  const [pct, setPct] = useState(0);
  const scrubbing = useRef(false);
  const rafRef = useRef<number | null>(null);

  // Track live scroll position → percent.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    const read = () => {
      rafRef.current = null;
      const max = vp.scrollHeight - vp.clientHeight;
      setPct(max > 0 ? (vp.scrollTop / max) * 100 : 0);
    };
    const onScroll = () => {
      if (rafRef.current == null) rafRef.current = requestAnimationFrame(read);
    };

    read();
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [viewportRef]);

  // Drag-to-scrub (right gauge only) + wheel forwarding (both gauges). The
  // gauge is an overlay SIBLING of the scroll viewport, so wheel/drag over it
  // can't reach the scroller on its own.
  const trackRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const track = trackRef.current;
    const vp = viewportRef.current;
    if (!track || !vp) return;

    const scrubTo = (clientY: number) => {
      const r = track.getBoundingClientRect();
      const t = Math.min(1, Math.max(0, (clientY - r.top) / r.height));
      vp.scrollTop = t * (vp.scrollHeight - vp.clientHeight);
    };
    const onDown = (e: PointerEvent) => {
      scrubbing.current = true;
      onScrubStart?.();
      track.setPointerCapture(e.pointerId);
      scrubTo(e.clientY);
    };
    const onMove = (e: PointerEvent) => {
      if (scrubbing.current) scrubTo(e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      scrubbing.current = false;
      try {
        track.releasePointerCapture(e.pointerId);
      } catch {
        /* capture may already be gone */
      }
    };
    // The gauge is an overlay SIBLING of the scroll viewport, so a wheel over
    // it can't bubble into the scroller — without this, hovering the right
    // edge would dead-zone the wheel. Forward it manually.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      vp.scrollTop += e.deltaY;
    };

    // Wheel forwarding always (both sides); drag-scrub only on the right.
    track.addEventListener("wheel", onWheel, { passive: false });
    if (draggable) {
      track.addEventListener("pointerdown", onDown);
      track.addEventListener("pointermove", onMove);
      track.addEventListener("pointerup", onUp);
      track.addEventListener("pointercancel", onUp);
    }
    return () => {
      track.removeEventListener("wheel", onWheel);
      track.removeEventListener("pointerdown", onDown);
      track.removeEventListener("pointermove", onMove);
      track.removeEventListener("pointerup", onUp);
      track.removeEventListener("pointercancel", onUp);
    };
  }, [draggable, viewportRef, onScrubStart]);

  return (
    <div
      ref={trackRef}
      aria-hidden
      className={cn(
        // The numeric ruler column. Insets match top AND bottom so the scale
        // is centered in the screen and both sides align row-for-row. Kept
        // narrow (~30px) and hugging the edge so it doesn't blanket the
        // content's right margin with a click-eating overlay.
        "console-gauge-ticks absolute inset-y-5 z-30 flex w-[30px] flex-col justify-between",
        "font-mono text-[9px] leading-none tracking-[0.12em] text-[color:var(--console-print)]",
        side === "left" ? "left-0 ml-2 items-start" : "right-0 mr-2 items-end",
        // Right gauge is the control: it scrubs on drag and forwards wheel to
        // the scroller. Left gauge is a passive readout mirror — fully
        // pointer-transparent so it never eats clicks/scroll over content.
        draggable ? "cursor-ns-resize touch-none" : "pointer-events-none"
      )}
    >
      {/* Fixed scale labels, evenly distributed top→bottom. Each is a number
          with a short major tick on its inboard side; the fine minor ticks
          live on the .console-gauge-ticks background behind. */}
      {LABELS.map((n) => (
        <span
          key={n}
          className={cn(
            "relative flex items-center gap-1 tabular-nums",
            side === "left" ? "flex-row" : "flex-row-reverse"
          )}
        >
          {fmt(n)}
          {/* short major tick beside the number, pointing inboard */}
          <span className="h-px w-2.5 bg-[color:var(--console-print)]" />
        </span>
      ))}

      {/* Live readout — rides to the current scroll %. On the right it's the
          machined handle (the value you read + grab); on the left it's a thin
          passive marker at the same height, so both move together. */}
      <div
        className={cn(
          "pointer-events-none absolute z-10 -translate-y-1/2",
          side === "left" ? "left-0" : "right-0"
        )}
        style={{ top: `${pct}%` }}
      >
        {side === "right" ? (
          <div className="console-gauge-readout flex items-center gap-1 px-1.5 py-1">
            <span className="font-mono text-[10px] font-medium leading-none tabular-nums text-ink">
              {fmt(pct)}
            </span>
          </div>
        ) : (
          <span className="block h-px w-5 bg-ink/70" />
        )}
      </div>
    </div>
  );
}
