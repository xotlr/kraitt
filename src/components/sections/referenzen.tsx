"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useMemo, useState } from "react";
import { SectionHeading } from "@/components/section-heading";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  categories,
  projects,
  type Category,
  type Project,
} from "@/data/projects";
import { cn } from "@/lib/utils";

export function Referenzen() {
  const [filter, setFilter] = useState<Category | "all">("all");
  const [active, setActive] = useState<Project | null>(null);

  const visible = useMemo(
    () =>
      filter === "all" ? projects : projects.filter((p) => p.category === filter),
    [filter]
  );

  return (
    <section
      id="referenzen"
      className="relative py-[var(--space-section)] overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="04"
          label="Referenzen"
          title={
            <>
              Eine Auswahl{" "}
              <span className="italic text-ink-muted">dessen, was bleibt.</span>
            </>
          }
        />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mb-14 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.22em]"
        >
          {categories.map((c) => {
            const isActive = filter === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setFilter(c.id)}
                className={cn(
                  "relative pb-1.5 transition-colors duration-500",
                  isActive ? "text-amber" : "text-ink-muted hover:text-ink"
                )}
              >
                {c.label}
                {isActive && (
                  <motion.span
                    layoutId="filter-underline"
                    className="absolute inset-x-0 -bottom-px h-px bg-amber"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
          <span className="ml-auto text-ink-faint">
            {String(visible.length).padStart(2, "0")} /{" "}
            {String(projects.length).padStart(2, "0")}
          </span>
        </motion.div>

        <ul className="border-t border-hairline">
          <AnimatePresence mode="popLayout">
            {visible.map((p, i) => (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{
                  duration: 0.7,
                  delay: i * 0.04,
                  ease: [0.22, 1, 0.36, 1],
                }}
                className="border-b border-hairline"
              >
                <button
                  onClick={() => setActive(p)}
                  className="group relative w-full text-left py-8 md:py-10 grid grid-cols-12 gap-4 items-baseline"
                >
                  <span className="col-span-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="col-span-12 md:col-span-5 font-display font-light text-2xl md:text-[2rem] tracking-tight transition-colors duration-500 group-hover:text-amber">
                    {p.title}
                  </span>
                  <span className="col-span-6 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    {p.role}
                  </span>
                  <span className="col-span-3 md:col-span-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                    {p.medium.split(" — ")[0]}
                  </span>
                  <span className="col-span-3 md:col-span-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint text-right">
                    {p.year}
                  </span>

                  <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-amber origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                </button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-amber mb-2">
                {active.year} · {active.client}
              </div>
              <DialogTitle>{active.title}</DialogTitle>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1 mb-5">
                {active.role} — {active.medium}
              </div>
              <DialogDescription className="text-base md:text-lg leading-[1.65] font-light">
                {active.description}
              </DialogDescription>
              <dl className="mt-7 pt-6 border-t border-hairline grid grid-cols-3 gap-4 font-mono text-[10px] uppercase tracking-[0.18em]">
                {active.credits.map((c) => (
                  <div key={c.label}>
                    <dt className="text-ink-faint mb-1">{c.label}</dt>
                    <dd className="text-ink/90">{c.value}</dd>
                  </div>
                ))}
              </dl>
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
