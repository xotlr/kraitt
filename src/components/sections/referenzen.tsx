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
import { projects, type Category, type Project } from "@/data/projects";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import {
  EASE,
  drawX as mkDrawX,
  fadeUp as mkFadeUp,
  makeStagger,
} from "@/lib/motion";

/** A project merged with its localized copy for the active language. */
type LocalizedProject = Project & {
  role: string;
  medium: string;
  description: string;
  credits: { label: string; value: string }[];
};

const filterStagger = makeStagger(0.08, 0.05);
const fadeUp = mkFadeUp(14, 0.8);
const drawX = mkDrawX(1);
const listContainer = makeStagger(0.08, 0.05);
const rowVariants = mkFadeUp(20, 0.8);

export function Referenzen() {
  const { lang } = useLanguage();
  const t = dict(lang).referenzen;
  const [filter, setFilter] = useState<Category | "all">("all");
  const [active, setActive] = useState<LocalizedProject | null>(null);

  // Merge each static project with its copy for the active language.
  const localized = useMemo<LocalizedProject[]>(
    () => projects.map((p) => ({ ...p, ...t.projects[p.id] })),
    [t]
  );

  const visible = useMemo(
    () =>
      filter === "all"
        ? localized
        : localized.filter((p) => p.category === filter),
    [filter, localized]
  );

  return (
    <section
      id="referenzen"
      className="relative py-[var(--space-section)] overflow-hidden"
    >
      <div className="relative z-10 container-edge">
        <SectionHeading
          index="04"
          label={t.label}
          title={
            <>
              {t.titleA}
              <span className="text-accent audio-accent">{t.titleEm}</span>
            </>
          }
        />

        <motion.div
          variants={filterStagger}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="mb-14 flex flex-wrap gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.22em]"
        >
          {t.categories.map((c) => {
            const id = c.id as Category | "all";
            const isActive = filter === id;
            return (
              <motion.button
                key={c.id}
                variants={fadeUp}
                onClick={() => setFilter(id)}
                className={cn(
                  "relative pb-1.5 transition-colors duration-500",
                  isActive ? "text-ink" : "text-ink-muted hover:text-ink"
                )}
              >
                {c.label}
                {isActive && (
                  <motion.span
                    layoutId="filter-underline"
                    className="absolute inset-x-0 -bottom-px h-px bg-ink"
                    transition={{ type: "spring", stiffness: 350, damping: 30 }}
                  />
                )}
              </motion.button>
            );
          })}
          <motion.span variants={fadeUp} className="ml-auto text-ink-faint">
            {String(visible.length).padStart(2, "0")} /{" "}
            {String(projects.length).padStart(2, "0")}
          </motion.span>
        </motion.div>

        <motion.div
          variants={listContainer}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-10%" }}
          className="relative"
        >
          <motion.span
            variants={drawX}
            style={{ transformOrigin: "left center" }}
            className="absolute inset-x-0 top-0 h-px bg-hairline"
          />
          <ul>
            <AnimatePresence mode="popLayout">
              {visible.map((p, i) => (
                <motion.li
                  key={p.id}
                  layout
                  variants={rowVariants}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, y: -12, transition: { duration: 0.4, ease: EASE } }}
                  className="relative"
                >
                  <button
                    onClick={() => setActive(p)}
                    className="group relative w-full text-left py-6 md:py-10 lg:grid lg:grid-cols-12 lg:gap-4 lg:items-baseline"
                  >
                    {/* Mobile/tablet layout: index + year pinned at top,
                        title below, then a single mono meta row. The
                        12-col grid used at lg+ wraps awkwardly under
                        ~900px because role/medium/year all try to fit
                        on one line beside the title. Stacking is
                        cleaner and reads faster on small screens. */}
                    <div className="flex items-baseline justify-between lg:hidden mb-2">
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint">
                        {p.year}
                      </span>
                    </div>
                    <span className="hidden lg:block lg:col-span-1 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-faint">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span className="block lg:col-span-5 font-heading text-2xl md:text-[2rem] transition-colors duration-500 group-hover:text-ink">
                      {p.title}
                    </span>
                    <span className="mt-3 lg:mt-0 block lg:col-span-3 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      {p.role}
                    </span>
                    <span className="mt-1 lg:mt-0 block lg:col-span-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-muted">
                      {p.medium.split(", ")[0]}
                    </span>
                    <span className="hidden lg:block lg:col-span-1 font-mono text-[10px] uppercase tracking-[0.18em] text-ink-faint text-right">
                      {p.year}
                    </span>

                    <span className="pointer-events-none absolute inset-x-0 -bottom-px h-px bg-ink/50 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                  </button>
                  <motion.span
                    variants={drawX}
                    style={{ transformOrigin: "left center" }}
                    className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-hairline"
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </motion.div>
      </div>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent>
          {active && (
            <>
              <div className="font-mono text-[10px] uppercase tracking-[0.25em] text-ink-muted mb-2">
                {active.year} · {active.client}
              </div>
              <DialogTitle>{active.title}</DialogTitle>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted mt-1 mb-5">
                {active.role} · {active.medium}
              </div>
              <DialogDescription className="text-base md:text-lg leading-[1.65] font-body">
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
              {active.link && (
                <a
                  href={active.link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group mt-7 inline-flex items-baseline gap-2 font-mono text-[10px] uppercase tracking-[0.2em] text-ink-muted transition-colors duration-500 hover:text-ink"
                >
                  <span className="relative">
                    {active.link.label}
                    <span className="pointer-events-none absolute inset-x-0 -bottom-0.5 h-px bg-ink/50 origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" />
                  </span>
                  <span aria-hidden className="text-ink-faint transition-transform duration-500 group-hover:translate-x-0.5">
                    ↗
                  </span>
                </a>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
