"use client";

import { motion, type Variants } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

const EASE = [0.22, 1, 0.36, 1] as const;

const stagger: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05,
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
  visible: { scaleX: 1, transition: { duration: 1, ease: EASE } },
};

const emailReveal: Variants = {
  hidden: {
    clipPath: "inset(0% 0% 100% 0%)",
    opacity: 0,
    y: 14,
  },
  visible: {
    clipPath: "inset(0% 0% 0% 0%)",
    opacity: 1,
    y: 0,
    transition: {
      duration: 1.1,
      ease: EASE,
      opacity: { duration: 0.6, ease: EASE },
    },
  },
};

const email = "hello@sufiankraitt.com";

const links: { label: string; href: string }[] = [
  { label: "Instagram", href: "https://instagram.com" },
  { label: "LinkedIn", href: "https://linkedin.com" },
  { label: "IMDb", href: "https://imdb.com" },
];

export function Kontakt() {
  return (
    <section
      id="kontakt"
      className="relative pt-[var(--space-section)] pb-16 overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="05"
          label="Kontakt"
          title={
            <>
              Lass uns über das{" "}
              <span className="font-serif-italic text-ink">Klangbild</span>{" "}
              sprechen.
            </>
          }
        />

        <motion.a
          href={`mailto:${email}`}
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="group block py-12 md:py-20"
        >
          <span className="block overflow-hidden pb-[0.1em]">
            <motion.span
              variants={emailReveal}
              className="font-display block text-[clamp(2.25rem,8vw,7.5rem)] leading-[0.95] text-balance text-ink/85 group-hover:text-ink transition-colors duration-700"
            >
              {email}
            </motion.span>
          </span>
          <motion.span
            variants={fadeUp}
            className="mt-8 inline-flex items-center gap-3 eyebrow text-ink-muted"
          >
            <motion.span
              variants={drawX}
              style={{ transformOrigin: "left center" }}
              className="block h-px w-10 bg-ink-muted"
            />
            E-Mail schreiben
          </motion.span>
        </motion.a>

        <motion.footer
          variants={stagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="relative mt-24 pt-8"
        >
          <motion.span
            variants={drawX}
            style={{ transformOrigin: "left center" }}
            className="absolute inset-x-0 top-0 h-px bg-hairline"
          />
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <motion.div variants={fadeUp} className="space-y-2 eyebrow">
              <p className="text-ink/80">Sufian Kraitt</p>
              <p>Audio Engineer · Wien, AT</p>
            </motion.div>

            <motion.ul
              variants={stagger}
              className="flex flex-wrap gap-x-5 gap-y-2 md:gap-7 font-mono text-[10px] uppercase tracking-[0.22em]"
            >
              {links.map((l) => (
                <motion.li key={l.label} variants={fadeUp}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-muted hover:text-ink transition-colors duration-500"
                  >
                    {l.label} ↗
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <motion.p variants={fadeUp} className="eyebrow text-ink-faint">
              © {new Date().getFullYear()} · All rights reserved.
            </motion.p>
          </div>
        </motion.footer>
      </div>
    </section>
  );
}
