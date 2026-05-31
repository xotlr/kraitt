"use client";

import { motion } from "framer-motion";
import { RailLabel } from "@/components/console/rail-primitives";
import { useAudioGlow } from "@/hooks/use-audio-glow";
import { cn } from "@/lib/utils";

/**
 * StudioButton — a tactile, textured push-button, the kind you'd thumb
 * on a hardware desk. Holds a Phosphor icon (regular weight idle, fill
 * weight active — passed by the caller); label is optional and usually
 * omitted on desktop to keep chrome minimal.
 *
 * Tactility comes from MATERIAL + LIGHT, not outlines. The cap is graphite
 * that sits LIGHTER than the panel it's milled into (--console-cap over
 * --console-panel), with a lit top bevel (--console-cap-hi) and a hard
 * contact-shadow line below (--console-edge) — so under one raking key
 * light it reads as a solid object standing proud of the surface, the way
 * an Apple hardware control does. Active LATCHES IN: the cap drops into the
 * panel, the bevel inverts to a recess and the contact shadow becomes an
 * inner shadow, so the press reads from depth alone — NO border-colour
 * change, NO outer glow. State colour lives only in the tone-coloured icon
 * + the corner LED.
 */
/**
 * Function tones — a button's active colour encodes WHAT it does, the way
 * a hardware desk colour-codes its caps. `tone` defaults to "nav" (amber,
 * the section/transport buttons). Source inputs get their own hues so MUS
 * and MIC don't read as the same control: playback = a cool signal green,
 * mic/record = the conventional red. The LED + icon both pick this up.
 */
export type ButtonTone = "nav" | "play" | "rec";

const TONE_COLOR: Record<ButtonTone, string> = {
  nav: "#c2a578", // on-theme gold — sections (matches the EQ/scene peak)
  play: "#5ec27a", // green — playback source live (kept: signal convention)
  rec: "#e0524e", // red — mic / record-armed (kept: signal convention)
};

// The COLD low end of the desk's intensity ramp (utils INTENSITY_RAMP[0]).
// Ramping tones (nav/play) rest HERE in silence and only warm toward their
// gold/green tone as audio drives --audio-tint. So an active-but-silent button
// reads cold + seated, never pre-lit amber — the warmth is the signal, not the
// resting state. (rec never ramps; it stays its semantic red.)
const RAMP_LOW = "#52617f";

export function StudioButton({
  label,
  active = false,
  tone = "nav",
  latch = true,
  disabled = false,
  size,
  dot = false,
  onClick,
  ariaLabel,
  ariaCurrent,
  children,
}: {
  label?: React.ReactNode;
  active?: boolean;
  /** What the button does, encoded as its active colour (see ButtonTone). */
  tone?: ButtonTone;
  /** Non-operational state (e.g. a source whose asset failed to load). Dims
   *  the cap, sets aria-disabled, and blocks the click — so the user sees
   *  the control is unavailable rather than clicking a dead button. */
  disabled?: boolean;
  /** Whether `active` reads as a LATCHED, seated-in cap (wash + ring +
   *  glow) — true for real toggles like sources, sections, mute/rec.
   *  Set false for always-lit *indicator* buttons (theme/language) whose
   *  icon is permanently coloured but which are not "pressed in" — they
   *  keep the flush idle cap and only tint the icon. */
  latch?: boolean;
  /** Cap edge in px. Defaults to the modular --console-unit token so one
   *  CSS value rescales every button + rail together. Pass a number only
   *  to override (e.g. the mobile panel). */
  size?: number;
  /** Show the top-right status LED — lit in the tone colour when active,
   *  dim otherwise. Used by the section + source buttons. */
  dot?: boolean;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  ariaLabel?: string;
  ariaCurrent?: boolean;
  children?: React.ReactNode;
}) {
  const dim = size != null ? `${size}px` : "var(--console-unit)";
  const toneColor = TONE_COLOR[tone];
  // A seated, pressed-in cap only when the button genuinely latches.
  const latched = active && latch;
  // Beat tint — useAudioGlow writes BOTH --audio-glow (0..1 scalar) and
  // --audio-tint (a colour on the desk's shared intensity ramp) on the icon
  // each frame. nav + play buttons RAMP their active colour with intensity:
  // cold blue when the music is quiet, gold on a peak — the same journey the
  // fader fill takes. rec (mic/record/mute) stays its semantic red regardless,
  // so an armed input is never mistaken for "low intensity". Idle buttons
  // write the vars too but don't read them, so nothing recolours until lit.
  // Only LATCHING toggles ramp (sections, sources) — they seat in and read as
  // "driven by the signal". Always-lit indicator buttons (theme/language,
  // latch=false) keep their static tone so they don't go cold/"off"-looking in
  // silence. rec stays semantic red either way.
  const rampsWithIntensity = tone !== "rec" && latch;
  // The active icon/LED colour: ramped tones read the live tint and REST at the
  // cold low end of the ramp in silence (not their gold/green tone) — so the
  // warmth only appears with audio. rec is fixed at its semantic red.
  const activeColor = rampsWithIntensity
    ? `var(--audio-tint, ${RAMP_LOW})`
    : toneColor;
  const glowRef = useAudioGlow<HTMLSpanElement>();
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-current={ariaCurrent ? "true" : undefined}
      aria-pressed={active}
      aria-disabled={disabled || undefined}
      // Focus ring on the BUTTON itself (the interactive element), not the
      // decorative span — so keyboard focus is announced + visible. rounded
      // matches the cap so the ring hugs the button shape.
      className={cn(
        "group flex flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-string)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-canvas)]",
        disabled && "cursor-not-allowed opacity-40"
      )}
      // Focus ring hugs the concentric cap shape (matches --console-cap-radius).
      style={{ borderRadius: "var(--console-cap-radius, 7px)" }}
    >
      <motion.span
        ref={glowRef}
        className={cn(
          "relative flex items-center justify-center",
          // The icon takes the function tone on active; idle is muted ink.
          active ? "" : "text-ink-muted group-hover:text-ink"
        )}
        // Spring-driven interaction. The cap LIFTS a hair on hover (a pad you
        // can feel under the cursor) and DEPRESSES on press — a real button
        // throw, not a 1px nudge. A latched cap sits slightly in at rest. The
        // spring gives it weight; whileTap fires on the parent button's press.
        initial={false}
        animate={{ y: latched ? 0.5 : 0 }}
        whileHover={disabled ? undefined : { y: latched ? 0 : -1.5 }}
        whileTap={disabled ? undefined : { y: 1 }}
        transition={{ type: "spring", stiffness: 600, damping: 26, mass: 0.5 }}
        style={{
          width: dim,
          height: dim,
          // Caps echo the navpill's curve: concentric with the group shell
          // (pill radius − pad) so a cap reads as nested inside the rounded
          // trough rather than a sharp chip sitting in it. Falls back to 7px
          // when there's no enclosing group var.
          borderRadius: "var(--console-cap-radius, 7px)",
          // Active icon colour. nav + play RAMP with audio intensity (cold blue
          // → gold via --audio-tint, written here by useAudioGlow); rec stays
          // its semantic red. Idle inherits the muted-ink class above. The
          // glyph's drop-shadow (inner span) reads --audio-glow for the pulse.
          color: active ? activeColor : undefined,
          transition: "color 200ms, box-shadow 220ms ease-out, background 220ms",
          // Graphite cap milled into the panel. IDLE: the cap sits LIGHTER
          // than the panel (--console-cap), a lit top bevel (--console-cap-hi)
          // grading to its own body, with a hard contact-shadow line below
          // (--console-edge) so it reads as a solid object proud of the
          // surface. LATCHED: it drops in — the fill darkens toward the panel,
          // the bevel inverts to an inner top shadow, the contact shadow
          // becomes an inner cradle. Depth alone carries the state.
          // Raked key light from the TOP-LEFT (≈115deg) rather than straight
          // down — the asymmetric sheen is the single biggest "real gear vs
          // plastic" tell. The cap gradient grades from a lit top-left edge to
          // a shaded bottom-right body.
          background: latched
            ? "linear-gradient(115deg, color-mix(in srgb, var(--console-panel) 80%, black) 0%, var(--console-panel) 100%)"
            : "linear-gradient(115deg, var(--console-cap-hi) 0%, var(--console-cap) 46%, color-mix(in srgb, var(--console-cap) 82%, black) 100%)",
          boxShadow: latched
            ? [
                // seated-in: deep inner top shadow = cap pushed down into the
                // panel; a faint bottom lip catches the key light at the floor.
                // No tone glow on the cap itself — the GLOW comes from the lit
                // icon now (drop-shadow on the glyph below), so the colour
                // reads as the indicator emitting, not the whole pad haloing.
                "inset 0 3px 5px color-mix(in srgb, black 55%, transparent)",
                "inset 0 1px 2px color-mix(in srgb, black 45%, transparent)",
                "inset 0 -1px 0 color-mix(in srgb, var(--console-cap-hi) 70%, transparent)",
                "0 0 0 1px var(--console-edge)",
              ].join(",")
            : [
                // raised pad under a raked top-left key light: the lit bevel
                // runs across the top-LEFT (inset +1px x, -1px y highlight),
                // the shade pools bottom-RIGHT (inset -1px x, +1px y), and the
                // cast shadow falls down-and-right (+1px x) like a real object
                // lit from the upper left — so each cap floats off the field
                // as its own distinct pad rather than a flat-lit square.
                // (Hover glow is a separate group-hover layer below, since an
                // inline box-shadow can't react to :hover.)
                "inset 1px 1px 0 color-mix(in srgb, white 16%, transparent)",
                "inset -1px -1px 1px color-mix(in srgb, black 48%, transparent)",
                "0 0 0 1px var(--console-edge)",
                "1px 1px 0 color-mix(in srgb, white 4%, transparent)",
                "1px 2px 3px color-mix(in srgb, black 40%, transparent)",
                "2px 4px 8px color-mix(in srgb, black 35%, transparent)",
              ].join(","),
        }}
      >
        {/* Hover edge-light — a faint tone-coloured bloom that fades in when
            the cap is hovered (and isn't already latched, which carries its
            own glow). Pointer-events-none, sits under the icon. Gives the
            "slight glow" + the sense the control is live on approach without
            adding a permanent ring. */}
        {dot && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-[3px] w-[3px] rounded-full transition-all duration-300"
            style={{
              background: active ? activeColor : "var(--color-ink-faint)",
              boxShadow: active
                ? `0 0 5px color-mix(in srgb, ${activeColor} 90%, transparent), 0 0 1px color-mix(in srgb, ${activeColor} 100%, transparent)`
                : "inset 0 0 1px color-mix(in srgb, black 60%, transparent)",
            }}
          />
        )}
        {/* The icon itself emits the glow — a tone-coloured drop-shadow on the
            glyph, so the light reads as the indicator lighting up rather than
            the whole cap haloing. Full when active; a faint bloom fades in on
            hover for idle caps. */}
        <span
          className={cn(
            "relative inline-flex",
            !active && !disabled && "group-hover:[filter:var(--icon-glow-hover)]"
          )}
          style={
            {
              // --audio-glow / --audio-tint inherit from the parent span (which
              // carries the useAudioGlow ref). The bloom IS the audio signal:
              // for ramping tones it scales entirely off --audio-glow, so an
              // active-but-silent button reads cold + seated with NO halo and
              // only blooms (and warms toward gold) as the beat drives it. rec
              // keeps a steady base bloom since it never ramps — an armed input
              // must read "lit" even in silence. Idle: no filter; hover: static.
              filter: active
                ? rampsWithIntensity
                  ? `drop-shadow(0 0 calc(var(--audio-glow) * 3px) color-mix(in srgb, ${activeColor} calc(var(--audio-glow) * 60%), transparent)) drop-shadow(0 0 calc(var(--audio-glow) * 9px) color-mix(in srgb, ${activeColor} calc(var(--audio-glow) * 55%), transparent))`
                  : `drop-shadow(0 0 2px color-mix(in srgb, ${activeColor} 60%, transparent)) drop-shadow(0 0 calc(4px + var(--audio-glow) * 7px) color-mix(in srgb, ${activeColor} calc(45% + var(--audio-glow) * 45%), transparent))`
                : undefined,
              "--icon-glow-hover": `drop-shadow(0 0 4px color-mix(in srgb, ${toneColor} 45%, transparent))`,
            } as React.CSSProperties
          }
        >
          {children}
        </span>
      </motion.span>
      {label != null && <RailLabel active={active}>{label}</RailLabel>}
    </button>
  );
}
