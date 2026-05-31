"use client";

import { motion, type Variants } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

const columnStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.12,
      delayChildren: 0.05,
    },
  },
};

const itemStagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.15,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE },
  },
};

const drawX: Variants = {
  hidden: { scaleX: 0 },
  visible: { scaleX: 1, transition: { duration: 0.9, ease: EASE } },
};

export function Leistungen() {
  const { lang } = useLanguage();
  const t = dict(lang).leistungen;
  const columns = t.columns;
  return (
    <section
      id="leistungen"
      className="relative py-[var(--space-section)]"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="03"
          label={t.label}
          title={
            <>
              {t.titleA}
              <span className="font-serif-italic text-ink">{t.titleEm}</span>
              {t.titleB}
            </>
          }
        />

        <motion.div
          variants={columnStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-14 md:gap-10 lg:gap-16"
        >
          {columns.map((col) => (
            <motion.div key={col.heading} variants={itemStagger}>
              <div className="relative flex items-baseline justify-between mb-8 pb-5">
                <motion.h3
                  variants={fadeUp}
                  className="font-heading text-h2 leading-none"
                >
                  {col.heading}
                </motion.h3>
                <motion.span
                  variants={fadeUp}
                  className="eyebrow text-ink-faint"
                >
                  {col.index}
                </motion.span>
                <motion.span
                  variants={drawX}
                  style={{ transformOrigin: "left center" }}
                  className="absolute inset-x-0 bottom-0 h-px bg-hairline"
                />
              </div>
              <ul>
                {col.items.map((item, ii) => (
                  <motion.li
                    key={item.name}
                    variants={fadeUp}
                    className="group relative"
                  >
                    <div className="flex items-baseline justify-between gap-4 py-5 cursor-default">
                      <span className="font-body text-lg md:text-xl text-ink/90 group-hover:text-ink transition-colors duration-500">
                        {item.name}
                      </span>
                      <span className="hidden lg:block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint text-right max-w-[55%]">
                        {item.desc}
                      </span>
                    </div>
                    {ii < col.items.length - 1 && (
                      <motion.span
                        variants={drawX}
                        style={{ transformOrigin: "left center" }}
                        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hairline"
                      />
                    )}
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-ink/40 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                  </motion.li>
                ))}
              </ul>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
