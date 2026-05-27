"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

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
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: 1, ease: [0.22, 1, 0.36, 1] }}
          className="group block py-12 md:py-20"
        >
          <span className="font-display block text-[clamp(2.25rem,8vw,7.5rem)] leading-[0.95] text-balance text-ink/85 group-hover:text-ink transition-colors duration-700">
            {email}
          </span>
          <span className="mt-8 inline-flex items-center gap-3 eyebrow text-ink-muted">
            <span className="block h-px w-10 bg-ink-muted" />
            E-Mail schreiben
          </span>
        </motion.a>

        <footer className="mt-24 pt-8 border-t border-hairline">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-8">
            <div className="space-y-2 eyebrow">
              <p className="text-ink/80">Sufian Kraitt</p>
              <p>Audio Engineer · Wien, AT</p>
            </div>

            <ul className="flex gap-7 font-mono text-[10px] uppercase tracking-[0.22em]">
              {links.map((l) => (
                <li key={l.label}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-muted hover:text-ink transition-colors duration-500"
                  >
                    {l.label} ↗
                  </a>
                </li>
              ))}
            </ul>

            <p className="eyebrow text-ink-faint">
              © {new Date().getFullYear()} · All rights reserved.
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
}
