"use client";

import { motion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";

const EASE = [0.22, 1, 0.36, 1] as const;

const container: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE },
  },
};

const drawX: Variants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 1.1, ease: EASE },
  },
};

// Title masks in from below using a clip-path inset.
// inset(top right bottom left) — animate bottom: 100% -> 0%.
const titleReveal: Variants = {
  hidden: {
    clipPath: "inset(0% 0% 100% 0%)",
    y: 18,
    opacity: 0,
  },
  visible: {
    clipPath: "inset(0% 0% 0% 0%)",
    y: 0,
    opacity: 1,
    transition: {
      duration: 1.15,
      ease: EASE,
      opacity: { duration: 0.6, ease: EASE },
    },
  },
};

export function SectionHeading({
  index,
  label,
  title,
  className,
}: {
  index: string;
  label: string;
  title: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-12%" }}
      className={cn("mb-16 md:mb-28", className)}
    >
      <div className="flex items-baseline gap-4 md:gap-6 mb-8 md:mb-10 eyebrow">
        <motion.span variants={fadeUp} className="text-ink">
          {index}
        </motion.span>
        <motion.span
          variants={drawX}
          style={{ transformOrigin: "left center" }}
          className="h-px flex-1 bg-hairline"
        />
        <motion.span variants={fadeUp}>{label}</motion.span>
      </div>
      <div className="overflow-hidden pb-[0.15em]">
        <motion.h2
          variants={titleReveal}
          className="font-heading text-h1 leading-[var(--text-h1--line-height)] max-w-[18ch] text-balance"
        >
          {title}
        </motion.h2>
      </div>
    </motion.div>
  );
}
