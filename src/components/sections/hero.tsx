"use client";

import { motion } from "framer-motion";

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
          <span className="h-px w-10 bg-amber/60" />
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
          className="font-display-thin text-display leading-[var(--text-display--line-height)] tracking-tighter text-balance"
        >
          <span className="block">Sufian</span>
          <span className="block italic text-ink-muted">
            Kraitt<span className="not-italic text-amber">.</span>
          </span>
        </motion.h1>

        <motion.p
          variants={rise}
          className="mt-12 md:mt-16 max-w-[44ch] text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/85 font-light"
        >
          Audio für{" "}
          <span className="italic text-amber">Film</span>,{" "}
          <span className="italic text-amber">Television</span> und{" "}
          <span className="italic text-amber">Musikproduktion</span> — am Set,
          im Studio, in der Post.
        </motion.p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 1.4 }}
        className="relative z-10 container-edge pb-12 md:pb-16"
      >
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6 eyebrow">
          <div className="flex flex-wrap gap-x-8 gap-y-3 text-ink/60">
            <span>Setton</span>
            <span>Postproduktion</span>
            <span>Mixing</span>
            <span>Mastering</span>
            <span>Komposition</span>
          </div>
          <a
            href="#ueber"
            className="group inline-flex items-center gap-3 text-ink/60 hover:text-amber transition-colors"
          >
            Scroll
            <span className="block h-px w-12 bg-current group-hover:w-20 transition-all duration-700" />
          </a>
        </div>
      </motion.div>
    </section>
  );
}
