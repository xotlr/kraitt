"use client";

import { motion, type Variants } from "framer-motion";
import { ChannelStrip } from "@/components/console/level-meter";
import { EASE } from "@/lib/motion";

/**
 * LeftRail — the LEFT console column, now the dedicated METERING INSTRUMENT:
 * the analog VU + fader + dBFS meter + live EQ, nothing clickable. All the
 * controls (nav, transport, settings, brand) live on the right KnobRail, so
 * the desk reads as instrument-on-the-left, controls-on-the-right.
 *
 * The strip fills the rail height inside its recessed navpill. lg+ only.
 */
const item: Variants = {
  hidden: { opacity: 0, x: -14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: EASE, delay: 0.5 } },
};

export function LeftRail() {
  return (
    <motion.div
      initial="hidden"
      animate="show"
      className="hidden lg:flex shrink-0 flex-col items-center select-none"
      style={{
        width: "var(--console-left-rail-w)",
        paddingTop: "var(--console-rail-inset)",
        paddingBottom: "var(--console-rail-inset)",
      }}
    >
      <motion.div
        variants={item}
        className="console-group min-h-0 flex-1 flex-col"
        style={{
          width:
            "calc(var(--console-strip-w) + var(--console-group-pad, 6px) * 2)",
        }}
      >
        <ChannelStrip />
      </motion.div>
    </motion.div>
  );
}
