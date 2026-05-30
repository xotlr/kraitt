"use client";

import { RailLabel } from "@/components/console/rail-primitives";
import { cn } from "@/lib/utils";

/**
 * StudioButton — a tactile, textured push-button, the kind you'd thumb
 * on a hardware desk. Holds a Phosphor icon (regular weight idle, fill
 * weight active — passed by the caller); label is optional and usually
 * omitted on desktop to keep chrome minimal.
 *
 * Tactility = the same near-black machined-plate language as the channel
 * strip: a beveled graphite cap (top highlight + bottom shade) raised off
 * the bezel. Active LATCHES IN — the cap seats down into the plate (the
 * bevel inverts to a deep inset recess) so the press reads from depth
 * alone, with NO border-colour change and NO outer glow. State colour
 * lives only in the tone-coloured icon + the corner LED.
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
  nav: "#b8845c", // amber — sections / transport
  play: "#5ec27a", // green — playback source live
  rec: "#e0524e", // red — mic / record-armed
};

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
        "group flex flex-col items-center gap-1.5 rounded-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-string)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--color-canvas)]",
        disabled && "cursor-not-allowed opacity-40"
      )}
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-[10px] transition-all duration-300",
          "group-active:translate-y-px",
          // The icon takes the function tone on active; idle is muted ink.
          active ? "" : "text-ink-muted group-hover:text-ink"
        )}
        style={{
          width: dim,
          height: dim,
          // Active icon = the function tone (amber nav / green play / red
          // rec). Idle inherits the muted-ink class above.
          color: active ? toneColor : undefined,
          // Machined cap — same near-black graphite faceplate language as
          // the channel strip: a beveled plate (top highlight, bottom shade)
          // raised off the bezel. Active LATCHES IN: the cap seats down into
          // the plate (the bevel inverts to an inset recess) so the press
          // reads from depth alone — NO border-colour change, NO outer glow.
          // State colour lives only in the icon + corner LED.
          background: latched
            ? "linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 4%, var(--color-canvas)) 0%, color-mix(in srgb, var(--color-ink) 8%, var(--color-canvas)) 100%)"
            : "linear-gradient(180deg, color-mix(in srgb, var(--color-ink) 9%, var(--color-canvas)) 0%, var(--color-canvas) 60%, color-mix(in srgb, black 30%, var(--color-canvas)) 100%)",
          boxShadow: latched
            ? [
                // seated-in recess: deep inset top shade reads as the cap
                // pushed down into the plate, faint bottom lip catches light.
                "inset 0 3px 6px color-mix(in srgb, black 65%, transparent)",
                "inset 0 1px 2px color-mix(in srgb, black 50%, transparent)",
                "inset 0 -1px 0 color-mix(in srgb, white 6%, transparent)",
                "0 0 0 1px var(--color-hairline)",
              ].join(",")
            : [
                // raised machined cap: top edge highlight + bottom edge shade
                "inset 0 1px 0 color-mix(in srgb, white 9%, transparent)",
                "inset 0 -1px 0 color-mix(in srgb, black 35%, transparent)",
                "0 0 0 1px var(--color-hairline)",
                "0 1px 3px color-mix(in srgb, black 40%, transparent)",
              ].join(","),
        }}
      >
        {dot && (
          <span
            aria-hidden
            className="absolute right-1.5 top-1.5 h-1 w-1 rounded-full transition-all duration-300"
            style={{
              background: active ? toneColor : "var(--color-ink-faint)",
              boxShadow: active
                ? `0 0 4px color-mix(in srgb, ${toneColor} 85%, transparent)`
                : "none",
            }}
          />
        )}
        {children}
      </span>
      {label != null && <RailLabel active={active}>{label}</RailLabel>}
    </button>
  );
}
