"use client";

import { motion, type Variants } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

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

const facts = [
  { k: "Basis", v: "Wien, AT" },
  { k: "Ausbildung", v: "SAE Institute" },
  { k: "Sprachen", v: "DE · EN · AR" },
  { k: "Arbeitet seit", v: "2018" },
];

export function Ueber() {
  return (
    <section
      id="ueber"
      className="relative py-[var(--space-section)] overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="02"
          label="Über"
          title={
            <>
              Ein Ohr für den{" "}
              <span className="font-serif-italic text-ink">Raum zwischen</span>{" "}
              den Tönen.
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
              Mein Weg in die Audiowelt begann mit der Frage, warum manche
              Aufnahmen{" "}
              <span className="font-serif-italic text-ink">da</span> sind und
              andere nicht. Heute arbeite ich an dieser Antwort jeden Tag —
              zwischen Tonangel und Mischpult, zwischen Set und Studio.
            </motion.p>
            <motion.p variants={fadeUp}>
              Nach meinem Abschluss am{" "}
              <span className="font-serif-italic text-ink">SAE Institute</span>{" "}
              habe ich mich auf den schmalen Grat zwischen technischer
              Präzision und gestalterischer Intuition spezialisiert. Film und TV
              verlangen Disziplin und Geschwindigkeit; Musik verlangt Geduld und
              Haltung. Beides interessiert mich gleichermaßen.
            </motion.p>
            <motion.p variants={fadeUp} className="text-ink-muted">
              Ich arbeite für ORF-Produktionen, Spielfilme, Kurzfilme,
              Dokumentationen und für Bands, die wissen, dass ein Song sich
              entscheidet, bevor er gemischt wird.
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
              {facts.map((f) => (
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
