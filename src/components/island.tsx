"use client";

import { useAudioGlow } from "@/hooks/use-audio-glow";

/**
 * Island — the monitor bezel.
 *
 * Conceptually: the site is a studio monitor. The shader (the live
 * signal) and the section content are shown ON the screen; the black
 * gutter around the card is the bezel / matte, the dead space around a
 * meter window or the frame line of a film image. The rounded card
 * clips everything to that screen, so the signal reads as CONTAINED and
 * monitored rather than bleeding to the device edge.
 *
 * The bezel is live: its border picks up the same amber beat-glow the
 * headings use (useAudioGlow drives --audio-glow), so the frame warms
 * and blooms faintly on the beat — the screen is lit by what's playing.
 * At rest it's a plain hairline.
 *
 * Layout responsibilities:
 *   - The island is the CENTER column of the 3-col console layout
 *     (left rail · screen · right rail). It fills its flex track (~90%
 *     of the row); the rails are the left/right framing, so the screen
 *     only needs a thin top/bottom gutter to read as inset.
 *   - Inner card: relative + overflow-hidden + rounded, so it is the
 *     positioning/clip context for the absolutely-filled <Scene/> and
 *     the scrolling content placed inside it by the caller.
 */
export function Island({ children }: { children: React.ReactNode }) {
  const edgeRef = useAudioGlow<HTMLDivElement>();

  // The outer column is transparent — the body chassis (charcoal grain in
  // dark, walnut in light) shows through the top/bottom gutter exactly as it
  // does through the side rails, so the screen sits in ONE continuous frame.
  // This used to fill --color-bezel, which put an opaque grey strip over the
  // chassis above and below the screen that did not match the rails. The
  // screen card below keeps its own bg-canvas, so only the gutter changes.
  return (
    <div className="flex-1 min-w-0 h-full py-2 sm:py-2.5 md:py-3">
      <div className="relative h-full w-full">
        <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] bg-canvas">
          {/* children render <Scene/> (z-0) then the scroll content
              (z-10). The readability scrim used to sit between them, but it
              read as a dark panel behind the type; removed in favour of a
              subtle per-text shadow (see .text-legible in globals.css) so
              the type stays readable over the terrain without a box. */}
          {children}
        </div>

        {/*
          Live bezel edge. A non-clipping overlay sibling (so its outer
          bloom can spill past the card onto the black gutter, which the
          card's own overflow-hidden would otherwise crop). --audio-glow
          (0..1) scales both an inner rim and a soft outer bloom.
          Pointer-events-none so it never eats clicks.

          The glow is NOT a baked amber accent — it's the SCREEN'S OWN
          LIGHT spilling onto the bezel, like a real monitor frame catching
          the glow of its display. So it uses the cool signal-white the
          terrain contours are drawn in (--color-string, #e6dfd1-ish via
          the cool line tone) rather than amber. It reads as a reflection
          of what's on screen, pulsing with the signal that drives it.
        */}
        <div
          ref={edgeRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1.25rem]"
          style={{
            // @ts-expect-error — CSS custom property, valid at runtime
            "--audio-glow": 0,
            // Base hairline always present; brightens with the signal.
            border: "1px solid var(--color-hairline)",
            boxShadow:
              // inner rim — the screen light catching the inside frame edge
              "inset 0 0 calc(var(--audio-glow) * 14px) rgba(221, 226, 234, calc(var(--audio-glow) * 0.28)), " +
              // outer bloom onto the black bezel — the display's spill light
              "0 0 calc(var(--audio-glow) * 30px) rgba(221, 226, 234, calc(var(--audio-glow) * 0.22))",
          }}
        />
      </div>
    </div>
  );
}
