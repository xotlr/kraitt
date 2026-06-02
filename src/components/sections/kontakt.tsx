"use client";

import { motion } from "framer-motion";
import { Accent } from "@/components/accent";
import { SectionHeading } from "@/components/section-heading";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import {
  drawX as mkDrawX,
  fadeUp as mkFadeUp,
  makeStagger,
  reveal,
} from "@/lib/motion";

const stagger = makeStagger(0.08, 0.05);
const fadeUp = mkFadeUp(18);
const drawX = mkDrawX(1);
// Fade + rise, no clip-path swipe — the inset() mask clipped the email's
// descenders (the @ and the 'j' in sufian) at large mono sizes.
const emailReveal = mkFadeUp(14, 1.1);

const email = "hello@sufiankraitt.com";

// Real, verified profiles only (no LinkedIn — none confirmed). Instagram
// @szumksufko is Sufian's handle / SzumK artist alias; IMDb nm17906294 is his
// verified credits page (also used on the project rows).
const links: { label: string; href: string }[] = [
  { label: "Instagram", href: "https://www.instagram.com/szumksufko/" },
  { label: "IMDb", href: "https://www.imdb.com/name/nm17906294/" },
];

export function Kontakt() {
  const { lang } = useLanguage();
  const t = dict(lang).kontakt;
  return (
    <section
      id="kontakt"
      className="relative pt-[var(--space-section)] pb-16 overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="05"
          label={t.label}
          title={
            <>
              {t.titleA}
              <Accent>{t.titleEm}</Accent>
              {t.titleB}
            </>
          }
        />

        <motion.a
          href={`mailto:${email}`}
          variants={stagger}
          {...reveal}
          className="group block py-12 md:py-20"
        >
          {/* The email is one unbreakable 22-char token, so it can't rely on
              text-balance — at the old 8vw / 7.5rem max it hit 36px and ran 475px
              wide on a 390px phone (overflow), and leading-0.95 clipped the @ / j
              descenders. Now: a min that fits a 360px screen (1.5rem), a vw term
              that scales smoothly, and a max capped at 5rem (a 22-char address
              never needs 120px). overflow-wrap:anywhere lets it break at the @ as
              a last resort on the very narrowest devices instead of overflowing.
              Leading lifted to 1.0 so descenders clear; pb keeps the baseline gap. */}
          <motion.span
            variants={emailReveal}
            style={{ overflowWrap: "anywhere" }}
            className="font-display block pb-[0.12em] text-[clamp(1.5rem,1rem+5vw,5rem)] leading-[1.02] text-ink/85 group-hover:text-ink transition-colors duration-700"
          >
            {email}
          </motion.span>
          <motion.span
            variants={fadeUp}
            className="mt-8 inline-flex items-center gap-3 eyebrow text-ink-muted"
          >
            <motion.span
              variants={drawX}
              style={{ transformOrigin: "left center" }}
              className="block h-px w-10 bg-ink-muted"
            />
            {t.write}
          </motion.span>
        </motion.a>

        <motion.footer
          variants={stagger}
          {...reveal}
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
              <p>{t.role}</p>
            </motion.div>

            <motion.ul
              variants={stagger}
              className="flex flex-wrap gap-x-5 gap-y-2 md:gap-7 mono-label tracking-[0.22em]"
            >
              {links.map((l) => (
                <motion.li key={l.label} variants={fadeUp}>
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-muted hover:text-ink transition-colors duration-500"
                  >
                    {l.label} <span aria-hidden>↗</span>
                  </a>
                </motion.li>
              ))}
            </motion.ul>

            <motion.p variants={fadeUp} className="eyebrow text-ink-faint">
              © {new Date().getFullYear()} · {t.rights}
            </motion.p>
          </div>
        </motion.footer>
      </div>
    </section>
  );
}
