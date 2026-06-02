"use client";

import { useEffect, useRef, useState } from "react";
import { SpectrumEq } from "@/components/console/spectrum-eq";
import { VuMeter } from "@/components/console/vu-meter";
import { useAudio, useAudioLevels } from "@/lib/audio";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import { INTENSITY_RAMP, intensityColor } from "@/lib/utils";

/**
 * ChannelStrip — a real console channel strip, not a grey volume bar.
 *
 * Two separate objects, the way a working engineer expects them:
 *
 *   ┌────────┬───────┐
 *   │ FADER  │ METER │
 *   │  ▢ cap │ ▰ 0   │  ← dBFS ladder, segmented
 *   │  │     │ ▰ -6  │     green ≤ -18, amber -18..-6, red > -6
 *   │  │     │ ▰ -12 │     peak-hold tick falls back slowly
 *   │  │  U  │ ▰ -18 │  ← U = unity (0 dB) mark on the fader taper
 *   │  │     │ ▰ -24 │
 *   │  │     │ ▱ -∞  │
 *   └────────┴───────┘
 *
 * The FADER sets playback volume (drag the cap). The METER is a passive
 * dBFS display of the live signal — it does not set anything.
 *
 * Honesty note: the shared audio level is a reactive 0..1 value (energy
 * above a rolling baseline), not a calibrated dBFS sample. We map it onto
 * a dBFS scale so the meter reads with real engineering vocabulary — the
 * scale gives the moving needle meaning — but it is a visual mapping, not
 * a metrologically exact peak meter. Floor is -48 dBFS; 1.0 maps to 0 dBFS.
 */

// Fader detents — the volume snaps to these notches so the handle settles on
// defined positions with a soft step rather than drifting to any analog
// value. 0 / 0.25 / 0.5 / 0.75 (unity) / 1.0 plus the halves between.
const FADER_STOPS = [0, 0.1, 0.25, 0.4, 0.5, 0.6, 0.75, 0.85, 1];
/** Snap a raw 0..1 value to the nearest detent. */
function snapVolume(v: number): number {
  let best = FADER_STOPS[0];
  let bestD = Math.abs(v - best);
  for (const s of FADER_STOPS) {
    const d = Math.abs(v - s);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

// The fader fill samples the SHARED intensity ramp (cold blue → purple-blue
// → silver → gold) at the handle's height — the same ramp the EQ, the lit
// buttons, and the editorial type use, so "intensity" reads as one colour
// language across the whole desk. See INTENSITY_RAMP in lib/utils.
const faderZoneColor = (v: number) => intensityColor(v, INTENSITY_RAMP);

export function ChannelStrip() {
  const levels = useAudioLevels();
  const { volume, setVolume, musicOn, micOn } = useAudio();
  const { lang } = useLanguage();
  const m = dict(lang).meter;
  const active = musicOn || micOn;
  // Colour of the fader's level fill at the current volume (see helper).
  const faderZone = faderZoneColor(volume);

  // Children driven by direct style writes on rAF so the signal band + peak
  // tick animate at 60fps with zero React re-render.
  const rootRef = useRef<HTMLDivElement>(null);

  // Tactile grab state: while the volume handle is being dragged, it depresses
  // and its shadow tightens — a knob you can grab vs a shape on the panel.
  const [grabbed, setGrabbed] = useState(false);

  // Clip latch — like a real console's PK LED: lights when the signal pins the
  // ceiling and STAYS lit until cleared. The live spectrum itself is shown by
  // the EQ now, so this rAF loop only watches for clip. Mirrored to a ref so
  // detection doesn't re-render every frame.
  const [clipped, setClipped] = useState(false);
  const clippedRef = useRef(false);
  const clearClip = () => {
    clippedRef.current = false;
    setClipped(false);
  };

  useEffect(() => {
    if (!active) return;
    let raf = 0;
    const tick = () => {
      const a = levels.current;
      // Honest post-fade peak — clip means the signal actually pinned the
      // ceiling at the set fader level, not that a beat spiked above baseline.
      const drive = a.peak;
      // Latch the clip once on the rising edge; the user clears it.
      if (drive >= 0.985 && !clippedRef.current) {
        clippedRef.current = true;
        setClipped(true);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [levels, active]);

  // Cap geometry (px). The slot's travel runs between PAD at top/bottom,
  // so the cap centre moves within (100% - 2*PAD); we offset by half the
  // cap height to centre it on the value. PAD = half the cap height so at
  // volume 0/1 the cap's bottom/top edge sits flush inside the slot ends
  // (it never hangs past the slot, which made the min look broken).
  const CAP_H = 14;
  const SLOT_PAD = CAP_H / 2;

  return (
    <div
      ref={rootRef}
      className="channel-strip relative flex h-full w-full flex-col gap-3 py-2"
      style={
        {
          // Zone colours, pulled from the SCENE so the meter is on-theme: the
          // terrain draws its contours in a cold silver-white warming to a
          // desaturated gold on beats (cool #e3e4e6 → gold #998f82), over a
          // cold blue-grey fill (#242b3a). The meter ramp echoes that — a
          // desaturated blue/purple-blue low, silvery mid, gold peak — instead
          // of traffic-light green/amber/red. Var names kept (the EQ + handle
          // read them) but the values are now the content palette.
          // On-theme zone colours (var names are legacy; values are the scene
          // palette). Used by the VU arc/needle + the volume handle. The EQ
          // interpolates its own RAMP in JS for a smooth gradient.
          "--meter-green": "#52617f", // low — desaturated cool blue
          "--meter-amber": "#aab0c0", // mid — silvery cool grey
          "--meter-red": "#c2a578", // peak — desaturated gold
        } as React.CSSProperties
      }
    >
      {/* Analog VU needle — the recognisable studio object, up top. Sized to
          roughly a button cap width and centred, so it reads as a compact dial
          seated above the wider meter bank rather than a full-width panel. */}
      <div
        className="shrink-0 self-center"
        style={{ width: "var(--console-unit)" }}
      >
        <VuMeter />
      </div>

      {/* ── EQ + VOLUME (combined) ─────────────────────────────────────────
          The live 3-band EQ is the whole module now — no separate fader column.
          Volume rides ACROSS it as a draggable horizontal handle: the EQ bands
          bounce live behind the handle, the handle's height is the set volume.
          A faint baseline glow rises through the bands to the volume level so
          the set level reads even in silence. One module, EQ-forward. */}
      <div className="relative flex min-h-0 flex-1 px-0.5">
        {/* Live spectrum fills the module. */}
        <SpectrumEq />

        {/* Volume level glow — a faint tone-coloured wash rising from the floor
            to the volume height, behind the handle, so the set level is
            legible across the EQ without a separate bar. Subtle: the EQ bands
            stay the bright element. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 z-[6] rounded-b-[6px]"
          style={{
            height: `calc(${SLOT_PAD}px + ${volume} * (100% - ${SLOT_PAD * 2}px))`,
            background: `linear-gradient(180deg, transparent 0%, color-mix(in srgb, ${faderZone} 14%, transparent) 100%)`,
            transition: "height 110ms var(--ease-out-soft), background 200ms",
          }}
        />

        {/* Volume handle — a horizontal bar spanning all three bands at the
            volume height. This is the fader: drag it (or the whole EQ) up/down.
            A molded graphite grip in the same cap language as the buttons,
            with a tone-coloured top edge so it reads as the level line. */}
        <div
          aria-hidden
          className="absolute inset-x-[1px] z-10 flex items-center justify-center rounded-[3px]"
          style={{
            height: `${CAP_H}px`,
            bottom: `calc(${volume} * (100% - ${SLOT_PAD * 2}px) + ${SLOT_PAD}px - ${CAP_H / 2}px)`,
            background:
              "linear-gradient(180deg, var(--console-cap-hi) 0%, var(--console-cap) 50%, color-mix(in srgb, var(--console-cap) 78%, black) 100%)",
            boxShadow: grabbed
              ? [
                  "inset 0 1px 0 color-mix(in srgb, white 10%, transparent)",
                  "inset 0 -1px 1px color-mix(in srgb, black 40%, transparent)",
                  "0 1px 1px color-mix(in srgb, black 60%, transparent)",
                  "0 0 0 1px var(--console-edge)",
                ].join(",")
              : [
                  "inset 0 1px 0 color-mix(in srgb, white 18%, transparent)",
                  "inset 0 -1px 1px color-mix(in srgb, black 35%, transparent)",
                  "0 2px 5px color-mix(in srgb, black 55%, transparent)",
                  "0 0 0 1px var(--console-edge)",
                ].join(","),
            transform: grabbed ? "translateY(0.5px)" : "translateY(0)",
            transition:
              "bottom 110ms var(--ease-out-soft), box-shadow 120ms, transform 120ms",
          }}
        >
          {/* Grip line + a thin tone edge along the top so the handle reads as
              the volume LEVEL line, coloured by the ramp at this height and
              eased so it blends as you ride the fader. */}
          <div
            className="absolute inset-x-1 top-0 h-[1.5px] rounded-full"
            style={{
              background: faderZone,
              boxShadow: `0 0 4px color-mix(in srgb, ${faderZone} 60%, transparent)`,
              transition: "background 200ms linear, box-shadow 200ms linear",
            }}
          />
          <div
            className="h-[2px] w-3 rounded-full"
            style={{
              background: "color-mix(in srgb, black 40%, transparent)",
              boxShadow: "0 1px 0 color-mix(in srgb, white 14%, transparent)",
            }}
          />
        </div>

        {/* Invisible vertical range over the whole EQ — drag anywhere on the
            module to set volume. */}
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => setVolume(snapVolume(parseFloat(e.target.value)))}
          onPointerDown={() => setGrabbed(true)}
          onPointerUp={() => setGrabbed(false)}
          onPointerCancel={() => setGrabbed(false)}
          onFocus={() => setGrabbed(true)}
          onBlur={() => setGrabbed(false)}
          aria-label={m.fader}
          aria-valuetext={`${Math.round(volume * 100)} %`}
          className="fader-input absolute inset-0 z-20 h-full w-full cursor-ns-resize"
        />

        {/* PK clip LED — top of the module. Latches red on clip, click to clear. */}
        <button
          type="button"
          onClick={clearClip}
          aria-label={clipped ? m.clip : m.levelOk}
          className="absolute left-1/2 top-[1px] z-30 flex -translate-x-1/2 items-center justify-center rounded-[3px]"
          style={{
            width: "16px",
            height: "7px",
            background: clipped
              ? "var(--meter-red)"
              : "color-mix(in srgb, var(--meter-red) 30%, black)",
            opacity: clipped ? 1 : 0.3,
            filter: clipped ? "brightness(1.2)" : "none",
            boxShadow: clipped
              ? "0 0 6px var(--meter-red), 0 0 2px var(--meter-red)"
              : "inset 0 0 0 1px color-mix(in srgb, black 50%, transparent)",
            transition: "opacity 120ms, box-shadow 120ms, filter 120ms",
          }}
        >
          <span
            className="font-mono leading-none"
            style={{
              fontSize: "5px",
              letterSpacing: "0.1em",
              color: clipped
                ? "color-mix(in srgb, black 60%, transparent)"
                : "var(--console-print)",
            }}
          >
            PK
          </span>
        </button>
      </div>

      {/* Silkscreen legend — engraved channel name under the module. Flows
          directly beneath the fader/meter/EQ row (not floated at the rail
          foot) so it labels the strip it belongs to. */}
      <span
        aria-hidden
        className="pointer-events-none shrink-0 text-center font-mono uppercase leading-none"
        style={{
          fontSize: "6px",
          letterSpacing: "0.34em",
          textIndent: "0.34em",
          color: "var(--console-print)",
          textShadow: "0 1px 0 color-mix(in srgb, white 6%, transparent)",
        }}
      >
        Master
      </span>

      <style jsx>{`
        .fader-input {
          -webkit-appearance: none;
          appearance: none;
          background: transparent;
          writing-mode: vertical-lr;
          direction: rtl;
        }
        /* Mouse focus stays clean; keyboard focus shows a visible ring
           around the slot so the fader's focus state is never invisible
           (WCAG 2.4.7). The ring sits on the input, which overlays the
           whole slot, so it reads as the fader being selected. */
        .fader-input:focus {
          outline: none;
        }
        .fader-input:focus-visible {
          outline: none;
          border-radius: 9999px;
          box-shadow: 0 0 0 2px var(--color-string);
        }
        .fader-input::-webkit-slider-runnable-track,
        .fader-input::-moz-range-track {
          background: transparent;
        }
        .fader-input::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 100%;
          height: ${CAP_H}px;
          background: transparent;
          cursor: ns-resize;
        }
        .fader-input::-moz-range-thumb {
          width: 100%;
          height: ${CAP_H}px;
          border: none;
          background: transparent;
          cursor: ns-resize;
        }
      `}</style>
    </div>
  );
}

