"use client";

import { motion } from "framer-motion";
import { useScrollTo } from "@/lib/scroll-context";

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.5 } },
};
const rise = {
  hidden: { y: 40, opacity: 0 },
  show: {
    y: 0,
    opacity: 1,
    transition: { duration: 1.4, ease: [0.22, 1, 0.36, 1] },
  },
};

export function Hero() {
  const scrollTo = useScrollTo();
  return (
    <section
      id="hero"
      className="relative min-h-[100svh] flex flex-col justify-between overflow-hidden"
    >
      <div className="relative z-10 container-edge pt-32 md:pt-40">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.6, delay: 0.3 }}
          className="eyebrow flex items-center gap-3"
        >
          <span className="h-px w-10 bg-ink-faint" />
          Wien · Audio Engineer · Verfügbar 2026
        </motion.p>
      </div>

      <motion.div
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative z-10 container-edge"
      >
        <motion.h1
          variants={rise}
          className="font-display text-display leading-[var(--text-display--line-height)] text-balance"
        >
          <span className="block">Sufian</span>
          <span className="block text-ink-muted">
            Kraitt
            {/* Dot picks up the string color so the wordmark belongs
                to the same cold palette as the shader. */}
            <span className="text-[color:var(--color-string)]">.</span>
          </span>
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-12 md:mt-16 max-w-[50ch] text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body"
        >
          Audio für{" "}
          <span className="font-serif-italic text-ink">Film</span>,{" "}
          <span className="font-serif-italic text-ink">Television</span> und{" "}
          <span className="font-serif-italic text-ink">Musikproduktion</span>{" "}
          — am Set, im Studio, in der Post.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 1.4 }}
        className="relative z-10 container-edge pb-12 md:pb-16"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 eyebrow">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-ink-muted">
            <span>Setton</span>
            <span>Postproduktion</span>
            <span>Mixing</span>
            <span>Mastering</span>
            <span>Komposition</span>
          </div>
          <a
            href="#ueber"
            onClick={scrollTo("ueber")}
            className="group inline-flex items-center gap-3 text-ink-muted hover:text-ink transition-colors"
          >
            Scroll
            <span className="block h-px w-12 bg-current group-hover:w-20 transition-all duration-700" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
