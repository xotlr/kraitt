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
