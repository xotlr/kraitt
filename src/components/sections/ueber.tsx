"use client";

import { motion } from "framer-motion";
import { Accent } from "@/components/accent";
import { SectionHeading } from "@/components/section-heading";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import { useAudioGlow } from "@/hooks/use-audio-glow";
import { drawX as mkDrawX, fadeUp as mkFadeUp, makeStagger } from "@/lib/motion";

const stagger = makeStagger(0.08, 0.1);
const fadeUp = mkFadeUp(18);
const drawX = mkDrawX();

export function Ueber() {
  const { lang } = useLanguage();
  const t = dict(lang).ueber;
  // Drives --audio-tint/--audio-glow onto the prose block so the bracketed
  // amber accents inside it (p1Em / p2Em) warm with the music. The heading
  // accent gets the same vars from SectionHeading's own ref.
  const proseRef = useAudioGlow<HTMLDivElement>();
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
              <Accent>{t.titleEm}</Accent>
              {t.titleB}
            </>
          }
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20">
          <motion.div
            ref={proseRef}
            variants={stagger}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-10%" }}
            className="lg:col-span-7 lg:col-start-2 space-y-7 text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body text-pretty text-legible"
          >
            <motion.p variants={fadeUp}>
              {t.p1a}
              <Accent>{t.p1Em}</Accent>
              {t.p1b}
            </motion.p>
            <motion.p variants={fadeUp}>
              {t.p2a}
              <Accent>{t.p2Em}</Accent>
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
            {/* A key/value fact grid. This is a styled list of label→value
                pairs, not prose definitions, so it's a plain <ul> rather than a
                <dl> — which lets each row also hold the animated hairline span
                without tripping axe's strict definition-list structure rule.
                The label/value relationship is conveyed visually + by order. */}
            <ul className="space-y-4 font-mono text-[10px] uppercase tracking-[0.18em]">
              {t.facts.map((f) => (
                <motion.li
                  key={f.k}
                  variants={fadeUp}
                  className="relative flex justify-between pb-3"
                >
                  <span className="text-ink-faint">{f.k}</span>
                  <span className="text-ink/85">{f.v}</span>
                  <motion.span
                    aria-hidden
                    variants={drawX}
                    style={{ transformOrigin: "left center" }}
                    className="absolute inset-x-0 bottom-0 h-px bg-hairline"
                  />
                </motion.li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
