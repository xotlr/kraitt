"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "@/components/section-heading";

type Column = {
  heading: string;
  index: string;
  items: { name: string; desc: string }[];
};

const columns: Column[] = [
  {
    heading: "Film & TV",
    index: "A",
    items: [
      { name: "Setton", desc: "On-location recording." },
      { name: "Tonassistenz", desc: "Boom, wireless, support." },
      { name: "Audiopostproduktion", desc: "Edit, design, mix." },
      { name: "Sprachbearbeitung", desc: "ADR, dialog clean-up." },
      { name: "Broadcast Audio", desc: "TV-konforme Mischung." },
    ],
  },
  {
    heading: "Studio & Musik",
    index: "B",
    items: [
      { name: "Bandrecordings", desc: "Live im Raum, ehrlich." },
      { name: "Vocal Recording", desc: "Stimme als Hauptdarsteller." },
      { name: "Musikproduktion", desc: "Vom Demo zum Master." },
      { name: "Mixing", desc: "Hybrid, in-the-box." },
      { name: "Mastering", desc: "Final translation." },
      { name: "Komposition", desc: "Score und Sounddesign." },
    ],
  },
  {
    heading: "Content & Medien",
    index: "C",
    items: [
      { name: "Podcast Recording", desc: "Mehrere Stimmen, ein Raum." },
      { name: "Audiorestauration", desc: "Archive retten." },
      { name: "Audio Cleanup", desc: "Rauschen, Hall, Artefakte." },
      { name: "Sprachaufnahmen", desc: "Voiceover, Hörbuch, IVR." },
      { name: "Social Media Audio", desc: "Mobil optimiert." },
      { name: "Voiceover", desc: "Werbung, Erklärfilme." },
    ],
  },
];

export function Leistungen() {
  return (
    <section
      id="leistungen"
      className="relative py-[var(--space-section)]"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="03"
          label="Leistungen"
          title={
            <>
              Was ich <span className="italic text-ink-muted">tue</span>, wenn
              ich arbeite.
            </>
          }
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-14 md:gap-10 lg:gap-16">
          {columns.map((col, ci) => (
            <motion.div
              key={col.heading}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-10%" }}
              transition={{
                duration: 1,
                delay: ci * 0.12,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <div className="flex items-baseline justify-between mb-8 pb-5 border-b border-hairline">
                <h3 className="font-display text-h2 leading-none tracking-tight font-light">
                  {col.heading}
                </h3>
                <span className="eyebrow text-amber">{col.index}</span>
              </div>
              <ul>
                {col.items.map((item) => (
                  <li
                    key={item.name}
                    className="group relative border-b border-hairline last:border-b-0"
                  >
                    <div className="flex items-baseline justify-between gap-4 py-5 cursor-default">
                      <span className="font-display text-lg md:text-xl font-light text-ink/90 group-hover:text-amber transition-colors duration-500">
                        {item.name}
                      </span>
                      <span className="hidden md:block font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint text-right max-w-[55%]">
                        {item.desc}
                      </span>
                    </div>
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-amber origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
