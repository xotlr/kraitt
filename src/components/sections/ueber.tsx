"use client";

import { motion, type Variants } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
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

export function Ueber() {
  const { lang } = useLanguage();
  const t = dict(lang).ueber;
  return (
    <section
      id="ueber"
      className="relative py-[var(--space-section)] overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="02"
          label={t.label}
          title={
            <>
              {t.titleA}
              <span className="font-serif-italic text-ink">{t.titleEm}</span>
              {t.titleB}
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            className="lg:col-span-7 lg:col-start-2 space-y-7 text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body text-pretty text-legible"
          >
            <motion.p variants={fadeUp}>
              {t.p1a}
              <span className="font-serif-italic text-ink">{t.p1Em}</span>
              {t.p1b}
            </motion.p>
            <motion.p variants={fadeUp}>
              {t.p2a}
              <span className="font-serif-italic text-ink">{t.p2Em}</span>
              {t.p2b}
            </motion.p>
            <motion.p variants={fadeUp} className="text-ink-muted">
              {t.p3}
            </motion.p>
          </motion.div>

          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            className="lg:col-span-3 lg:col-start-10"
          >
            <dl className="space-y-4 font-mono text-[10px] uppercase tracking-[0.18em]">
              {t.facts.map((f) => (
                <motion.div
                  key={f.k}
                  variants={fadeUp}
                  className="relative flex justify-between pb-3"
                >
                  <dt className="text-ink-faint">{f.k}</dt>
                  <dd className="text-ink/85">{f.v}</dd>
                  <motion.span
                    variants={drawX}
                    style={{ transformOrigin: "left center" }}
                    className="absolute inset-x-0 bottom-0 h-px bg-hairline"
                  />
                </motion.div>
              ))}
            </dl>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
