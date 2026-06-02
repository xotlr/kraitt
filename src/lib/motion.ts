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

/**
 * The scroll-reveal trigger every section shares: start hidden, play once when
 * the block scrolls into view, fire a touch before its top edge clears. Spread
 * onto any motion element driving a variants reveal — `<motion.div {...reveal}
 * variants={…}>` — so the four-line incantation lives in one place. The variants
 * (which shapes animate) stay at the call site; only the trigger is shared.
 * (SectionHeading keeps its own -12% margin — a deliberately different cue, not
 * a copy of this one.)
 */
export const reveal = {
  initial: "hidden",
  whileInView: "visible",
  viewport: { once: true, margin: "-10%" },
} as const;
