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

  return (
    <div className="flex-1 min-w-0 h-full bg-canvas py-2 sm:py-2.5 md:py-3">
      <div className="relative h-full w-full">
        <div className="relative h-full w-full overflow-hidden rounded-[1.25rem] bg-canvas">
          {/* children render <Scene/> (z-0) then the scroll content
              (z-10). The readability gradient sits between them (z-1),
              clipped to the card like everything else on the screen. */}
          {children}
          <div aria-hidden className="island-readability" />
        </div>

        {/*
          Live bezel edge. A non-clipping overlay sibling (so its outer
          amber bloom can spill past the card onto the black gutter,
          which the card's own overflow-hidden would otherwise crop).
          --audio-glow (0..1) scales both a warm inner border tint and a
          soft outer bloom. Pointer-events-none so it never eats clicks.
        */}
        <div
          ref={edgeRef}
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[1.25rem]"
          style={{
            // @ts-expect-error — CSS custom property, valid at runtime
            "--audio-glow": 0,
            // Base hairline always present; warms toward amber on beat.
            border: "1px solid var(--color-hairline)",
            boxShadow:
              // inner warm rim, scaled by glow
              "inset 0 0 calc(var(--audio-glow) * 12px) rgba(184, 132, 92, calc(var(--audio-glow) * 0.35)), " +
              // outer bloom onto the black bezel, scaled by glow
              "0 0 calc(var(--audio-glow) * 26px) rgba(184, 132, 92, calc(var(--audio-glow) * 0.28))",
          }}
        />
      </div>
    </div>
  );
}
