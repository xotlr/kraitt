"use client";

import { RailLabel } from "@/components/console/rail-primitives";
import { cn } from "@/lib/utils";

/**
 * StudioButton — a tactile, textured push-button, the kind you'd thumb
 * on a hardware desk. Holds a Phosphor icon (regular weight idle, fill
 * weight active — passed by the caller); label is optional and usually
 * omitted on desktop to keep chrome minimal.
 *
 * Tactility = layered shadows on a rounded square: top highlight + bottom
 * shade read as a molded dome; active inverts to a pressed-in, amber-lit,
 * ringed cap — a latched channel button pushed in and glowing. A corner
 * LED reinforces state at a glance.
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
      onClick={onClick}
      aria-label={ariaLabel}
      aria-current={ariaCurrent ? "true" : undefined}
      aria-pressed={active}
      className="group flex flex-col items-center gap-1.5 outline-none"
    >
      <span
        className={cn(
          "relative flex items-center justify-center rounded-[10px] transition-all duration-300",
          "group-active:translate-y-px group-focus-visible:ring-1 group-focus-visible:ring-[color:var(--color-string)]",
          // The icon takes the function tone on active; idle is muted ink.
          active ? "" : "text-ink-muted group-hover:text-ink"
        )}
        style={{
          width: dim,
          height: dim,
          // Active icon = the function tone (amber nav / green play / red
          // rec). Idle inherits the muted-ink class above.
          color: active ? toneColor : undefined,
          // Cap fill is the page CANVAS — the button blends flush into the
          // background and is defined by its hairline ring, not a raised
          // chip. Active latches IN: a faint tone-tinted wash + a deeper
          // inset shadow so the cap reads as pressed and seated, plus a
          // tone-coloured ring so the whole cap (not just the icon) lights.
          backgroundColor: latched
            ? `color-mix(in srgb, ${toneColor} 12%, var(--color-canvas))`
            : "var(--color-canvas)",
          boxShadow: latched
            ? [
                `inset 0 1px 3px color-mix(in srgb, var(--color-ink) 28%, transparent)`,
                `inset 0 0 0 1px color-mix(in srgb, ${toneColor} 55%, transparent)`,
                `0 0 8px color-mix(in srgb, ${toneColor} 30%, transparent)`,
              ].join(",")
            : [
                "inset 0 1px 0 color-mix(in srgb, white 6%, transparent)",
                "0 0 0 1px var(--color-hairline)",
                "0 1px 2px color-mix(in srgb, var(--color-ink) 12%, transparent)",
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
