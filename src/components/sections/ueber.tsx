"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

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
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 lg:col-start-2 space-y-7 text-body-lg leading-[var(--text-body-lg--line-height)] text-ink/80 font-body text-pretty"
          >
            <p>
              Mein Weg in die Audiowelt begann mit der Frage, warum manche
              Aufnahmen{" "}
              <span className="font-serif-italic text-ink">da</span> sind und
              andere nicht. Heute arbeite ich an dieser Antwort jeden Tag —
              zwischen Tonangel und Mischpult, zwischen Set und Studio.
            </p>
            <p>
              Nach meinem Abschluss am{" "}
              <span className="font-serif-italic text-ink">SAE Institute</span>{" "}
              habe ich mich auf den schmalen Grat zwischen technischer
              Präzision und gestalterischer Intuition spezialisiert. Film und TV
              verlangen Disziplin und Geschwindigkeit; Musik verlangt Geduld und
              Haltung. Beides interessiert mich gleichermaßen.
            </p>
            <p className="text-ink-muted">
              Ich arbeite für ORF-Produktionen, Spielfilme, Kurzfilme,
              Dokumentationen und für Bands, die wissen, dass ein Song sich
              entscheidet, bevor er gemischt wird.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 1, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-3 lg:col-start-10"
          >
            <dl className="space-y-4 font-mono text-[10px] uppercase tracking-[0.18em]">
              {facts.map((f) => (
                <div
                  key={f.k}
                  className="flex justify-between border-b border-hairline pb-3"
                >
                  <dt className="text-ink-faint">{f.k}</dt>
                  <dd className="text-ink/85">{f.v}</dd>
                </div>
              ))}
            </dl>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
