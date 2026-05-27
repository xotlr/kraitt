"use client";

import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { useScrollTo, useScrollViewport } from "@/lib/scroll-context";
import { cn } from "@/lib/utils";

const sections = [
  { id: "hero", label: "Index" },
  { id: "ueber", label: "Über" },
  { id: "leistungen", label: "Leistungen" },
  { id: "referenzen", label: "Referenzen" },
  { id: "kontakt", label: "Kontakt" },
];

export function Nav() {
  const [active, setActive] = useState("hero");
  const viewportRef = useScrollViewport();

  useEffect(() => {
    // Root is the ScrollArea viewport — section visibility is computed
    // relative to that scroll container, not the document. Defer one
    // frame so the viewport ref has been attached.
    let cleanup: (() => void) | null = null;
    const id = requestAnimationFrame(() => {
      const root = viewportRef.current;
      if (!root) return;
      const observers: IntersectionObserver[] = [];
      sections.forEach((s) => {
        const el = document.getElementById(s.id);
        if (!el) return;
        const obs = new IntersectionObserver(
          ([entry]) => {
            if (entry.isIntersecting) setActive(s.id);
          },
          { root, rootMargin: "-40% 0px -55% 0px", threshold: 0 }
        );
        obs.observe(el);
        observers.push(obs);
      });
      cleanup = () => observers.forEach((o) => o.disconnect());
    });
    return () => {
      cancelAnimationFrame(id);
      cleanup?.();
    };
  }, [viewportRef]);

  const scrollTo = useScrollTo();

  return (
    <motion.nav
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.4, delay: 0.6, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-0 left-0 right-0 z-40 px-[var(--gutter)] py-6"
    >
      <div className="max-w-[var(--container-max)] mx-auto flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.22em] text-ink-muted">
        <a
          href="#hero"
          onClick={scrollTo("hero")}
          className="font-display text-sm normal-case text-ink"
        >
          sk
        </a>
        <ul className="hidden md:flex gap-8">
          {sections.slice(1).map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={scrollTo(s.id)}
                className={cn(
                  "relative px-1 py-2 transition-colors duration-500",
                  active === s.id
                    ? "text-ink"
                    : "text-ink-muted hover:text-ink"
                )}
              >
                {s.label}
                {active === s.id && (
                  <motion.span
                    layoutId="nav-underline"
                    className="absolute inset-x-1 -bottom-px h-px bg-ink"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
              </a>
            </li>
          ))}
        </ul>
        <a
          href="mailto:hello@sufiankraitt.com"
          className="hidden md:inline text-ink-muted hover:text-ink transition-colors"
        >
          hello@sufiankraitt.com
        </a>
      </div>
    </motion.nav>
  );
}
