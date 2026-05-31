import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/* ------------------------------------------------------------------ */
/*  Intensity colour ramp — the desk's shared "how loud" palette       */
/* ------------------------------------------------------------------ */

/**
 * One ramp the whole console speaks: cold blue (quiet) → purple-blue →
 * silver → gold (peak). The fader fill, the EQ, the lit buttons, and the
 * editorial type all sample THIS so "intensity" reads as the same colour
 * journey everywhere — low energy is cold, a peak is gold. Stops are RGB
 * triplets; the low stop (#52617f) is the canonical "low-intensity" colour
 * referenced by the volume slider.
 */
export const INTENSITY_RAMP: readonly [number, number, number][] = [
  [0x52, 0x61, 0x7f], // low — desaturated cold blue
  [0x6f, 0x6f, 0x96], // purple-blue
  [0xaa, 0xb0, 0xc0], // silver
  [0xc2, 0xa5, 0x78], // peak — desaturated gold
];

/**
 * Sample the intensity ramp at t (0..1) and return an `rgb(...)` string.
 * t is clamped; segments are linearly interpolated for a smooth gradient
 * with no hard zone cuts.
 */
export function intensityColor(
  t: number,
  ramp: readonly [number, number, number][] = INTENSITY_RAMP
): string {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const seg = clamped * (ramp.length - 1);
  const i = Math.min(ramp.length - 2, Math.floor(seg));
  const f = seg - i;
  const a = ramp[i];
  const b = ramp[i + 1];
  const m = (j: number) => Math.round(a[j] + (b[j] - a[j]) * f);
  return `rgb(${m(0)}, ${m(1)}, ${m(2)})`;
}
