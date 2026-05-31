import { type Variants } from "framer-motion";

// Shared reveal choreography. Every section used to redeclare this same ease
// plus near-identical fadeUp/drawX/stagger variants; they live here now so the
// timing is one source of truth. The factories keep the per-section knobs
// (offset distance, draw duration, stagger spacing) that did legitimately
// differ — the shape is shared, the values stay tunable at the call site.

export const EASE = [0.22, 1, 0.36, 1] as const;

/** Fade + rise. `y` is the start offset in px (default 16). */
export const fadeUp = (y = 16, duration = 0.9): Variants => ({
  hidden: { opacity: 0, y },
  visible: { opacity: 1, y: 0, transition: { duration, ease: EASE } },
});

/** Hairline that draws in from its left edge. */
export const drawX = (duration = 0.9): Variants => ({
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration, ease: EASE } },
});

/** Container that staggers its children's reveals. */
export const makeStagger = (children = 0.08, delay = 0.05): Variants => ({
  hidden: {},
  visible: { transition: { staggerChildren: children, delayChildren: delay } },
});

/** Masks in from below via a clip-path inset (titles, the email block). */
export const maskUp = (y = 18, duration = 1.15): Variants => ({
  hidden: { clipPath: "inset(0% 0% 100% 0%)", y, opacity: 0 },
  visible: {
    clipPath: "inset(0% 0% 0% 0%)",
    y: 0,
    opacity: 1,
    transition: { duration, ease: EASE, opacity: { duration: 0.6, ease: EASE } },
  },
});
