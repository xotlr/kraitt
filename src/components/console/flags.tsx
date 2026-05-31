/**
 * Minimal national-flag SVGs for the language toggle. Hand-drawn (no flag
 * set in phosphor) and kept simple/legible at ~20px. Rounded clip so they
 * sit nicely inside the studio-button cap.
 *
 * AT (Austria) = red / white / red horizontal bands → German.
 * GB (United Kingdom) = Union Jack → English.
 */

import { useId } from "react";

export function FlagAT({ size = 20 }: { size?: number }) {
  const r = Math.round(size * 0.18);
  // Unique per instance — during the AnimatePresence popLayout swap the
  // outgoing and incoming flags briefly coexist, and a shared id would make
  // one flag's clipPath resolve to the other's.
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="24" rx={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="24" height="24" fill="#ed2939" />
        <rect y="8" width="24" height="8" fill="#fff" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx={r}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
      />
    </svg>
  );
}

export function FlagGB({ size = 20 }: { size?: number }) {
  const r = Math.round(size * 0.18);
  const clipId = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <clipPath id={clipId}>
          <rect width="24" height="24" rx={r} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        <rect width="24" height="24" fill="#012169" />
        {/* white diagonals */}
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#fff" strokeWidth="5" />
        {/* red diagonals (St Patrick), clipped to quadrants for the
            proper offset look — simplified to thin red over white */}
        <path d="M0,0 L24,24 M24,0 L0,24" stroke="#c8102e" strokeWidth="2" />
        {/* white cross */}
        <path d="M12,0 V24 M0,12 H24" stroke="#fff" strokeWidth="7" />
        {/* red cross */}
        <path d="M12,0 V24 M0,12 H24" stroke="#c8102e" strokeWidth="4" />
      </g>
      <rect
        x="0.5"
        y="0.5"
        width="23"
        height="23"
        rx={r}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
      />
    </svg>
  );
}
