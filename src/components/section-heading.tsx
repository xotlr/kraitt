"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useAudioGlow } from "@/hooks/use-audio-glow";
import { drawX, fadeUp, makeStagger, maskUp } from "@/lib/motion";

// The heading itself stays NEUTRAL ink. useAudioGlow still writes
// --audio-tint / --audio-glow onto this <h2> each frame, but the heading no
// longer consumes them — instead the vars INHERIT down to the Fraunces
// italic accent inside the title (the .audio-accent span), which is the
// element that now warms and blooms with the music. Seeding --audio-glow: 0
// here gives the accent a defined resting value before the first rAF write.
const audioVarSeed: React.CSSProperties = {
  // @ts-expect-error — custom property, valid CSS, not in the TS type
  "--audio-glow": 0,
};

const container = makeStagger(0.12, 0.05);
const headingFade = fadeUp(12);
const headingDraw = drawX(1.1);
// Title masks in from below using a clip-path inset.
const titleReveal = maskUp(18, 1.15);

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
  const titleRef = useAudioGlow<HTMLHeadingElement>();
  return (
    <motion.div
      variants={container}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, margin: "-12%" }}
      className={cn("mb-16 md:mb-28", className)}
    >
      <div className="flex items-baseline gap-4 md:gap-6 mb-8 md:mb-10 eyebrow">
        <motion.span variants={headingFade} className="text-ink">
          {index}
        </motion.span>
        <motion.span
          variants={headingDraw}
          style={{ transformOrigin: "left center" }}
          className="h-px flex-1 bg-hairline"
        />
        <motion.span variants={headingFade}>{label}</motion.span>
      </div>
      <div className="overflow-hidden pb-[0.15em]">
        <motion.h2
          ref={titleRef}
          variants={titleReveal}
          style={audioVarSeed}
          className="font-heading text-h1 leading-[var(--text-h1--line-height)] max-w-[18ch] text-balance text-legible text-ink"
        >
          {title}
        </motion.h2>
      </div>
    </motion.div>
  );
}
