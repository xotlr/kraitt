"use client";

import { useAudioGlow } from "@/hooks/use-audio-glow";
import { GrainOverlay } from "@/components/grain-overlay";
import { ScrollGauge } from "@/components/console/scroll-gauge";

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
          {/* Readability scrim. Sits between the scene (z-0) and the scroll
              content (z-10): a soft, full-bleed darkening of the screen so the
              editorial type reads cleanly over the terrain. A previous version
              was removed for looking like a hard panel behind the type — this
              is deliberately gentle (low-opacity black, no edges, no box) so it
              reads as the screen being a touch dimmer under the content, not as
              a plate. Dark mode only; the light/paper theme needs no scrim.
              Pointer-events-none so it never eats scroll/clicks. */}
          <div
            aria-hidden
            className="content-scrim pointer-events-none absolute inset-0 z-[5]"
          />
          {/* A SECOND grain pass, scoped to the island and clipped to its
              rounded screen. It sits ABOVE the scene + scrim (z-6) but BELOW
              the content (z-10), so it gives the screen surface extra tooth
              where the user wanted more texture, without piling grain onto the
              editorial type. Stacks additively (screen blend) on top of the
              page-wide layer. */}
          <GrainOverlay position="absolute" grainPx={1.0} amount={0.16} />
          {/* children render <Scene/> (z-0) then the scroll content (z-10). */}
          {children}

          {/* LIQUID-GLASS edge — a thick glass cover over the monitor screen.
              Sits ABOVE the content (z-20) but pointer-events-none. The look is
              built from stacked, non-competing light layers (specular top-left
              rim, inner bevel thickness, top sheen), all MASKED to a thin band
              around the perimeter so it's an EDGE effect and never veils the
              editorial body. See .liquid-glass-edge in globals.css. */}
          <div
            aria-hidden
            className="liquid-glass-edge pointer-events-none absolute inset-0 z-20 rounded-[1.25rem]"
          />

          {/* Numeric measurement rulers framing the screen. Both carry the
              same fixed 00–100 scale and track live scroll %, so they read as
              ONE instrument: the RIGHT is the draggable scrubber (the value
              handle you grab), the LEFT mirrors its position passively. They
              share inset-y-5 so the scales align row-for-row. */}
          <ScrollGauge side="left" />
          <ScrollGauge side="right" draggable />
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
