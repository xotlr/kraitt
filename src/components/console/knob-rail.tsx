"use client";

import { motion, type Variants } from "framer-motion";
import { SECTIONS } from "@/components/console/controls";
import { LanguageToggle } from "@/components/console/language-toggle";
import { StudioButton } from "@/components/console/studio-button";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { useActiveSection } from "@/components/console/use-active-section";
import { useAudio } from "@/lib/audio";
import { useScrollTo } from "@/lib/scroll-context";

/**
 * KnobRail — the RIGHT console column: a single vertical row of tactile
 * studio buttons, icon-only (no text) to keep chrome minimal. Each
 * section button shows its Phosphor icon as an outline, filling amber +
 * depressing when its section is in view; click to scroll there. The
 * language toggle is the same kind of button at the bottom.
 *
 * When no audio source is playing, pressing a section button also fires
 * a manual wave pulse (triggerPulse) so the desk visibly drives the
 * signal even in silence.
 *
 * lg+ only; below lg the bottom ConsolePanel takes over.
 */
const rail: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function KnobRail() {
  const active = useActiveSection();
  const scrollTo = useScrollTo();
  const { musicOn, micOn, triggerPulse } = useAudio();
  const audioOff = !musicOn && !micOn;

  const handleSection =
    (id: string): React.MouseEventHandler<HTMLButtonElement> =>
    (e) => {
      if (audioOff) triggerPulse();
      scrollTo(id)(e);
    };

  return (
    <motion.nav
      aria-label="Sektionen"
      variants={rail}
      initial="hidden"
      animate="show"
      className="hidden lg:flex shrink-0 flex-col items-center justify-between py-2 sm:py-2.5 md:py-3"
      style={{ width: "var(--console-rail-w)" }}
    >
      {/* Section nav — pinned to the TOP of the rail. */}
      <div className="flex flex-col items-center gap-5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <motion.div key={s.id} variants={item}>
              <StudioButton
                active={isActive}
                dot
                onClick={handleSection(s.id)}
                ariaLabel={s.label}
                ariaCurrent={isActive}
              >
                <Icon size={24} weight={isActive ? "fill" : "regular"} />
              </StudioButton>
            </motion.div>
          );
        })}
      </div>

      {/* Theme + language switches — pinned to the BOTTOM of the rail. */}
      <motion.div variants={item} className="flex flex-col items-center gap-5">
        <ThemeToggle iconSize={24} />
        {/* Language toggle — flag switch. Functional state (persists, sets
            <html lang>); copy translation is a later pass. */}
        <LanguageToggle iconSize={24} />
      </motion.div>
    </motion.nav>
  );
}
