"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

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
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-12%" }}
      transition={{ duration: 1.1, ease: [0.22, 1, 0.36, 1] }}
      className={cn("mb-20 md:mb-28", className)}
    >
      <div className="flex items-baseline gap-6 mb-10 eyebrow">
        <span className="text-ink">{index}</span>
        <span className="h-px flex-1 bg-hairline" />
        <span>{label}</span>
      </div>
      <h2 className="font-heading text-h1 leading-[var(--text-h1--line-height)] max-w-[18ch] text-balance">
        {title}
      </h2>
    </motion.div>
  );
}
