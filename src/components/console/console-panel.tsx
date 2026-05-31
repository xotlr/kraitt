"use client";

import { Microphone, Pause, Play } from "@phosphor-icons/react";
import { motion } from "framer-motion";
import { SECTIONS } from "@/components/console/controls";
import { LanguageToggle } from "@/components/console/language-toggle";
import { StudioButton } from "@/components/console/studio-button";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { useSectionNav } from "@/components/console/use-active-section";
import { useAudio } from "@/lib/audio";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n";

/**
 * ConsolePanel — the mobile console. Below lg the same controls fold into
 * a horizontal strip pinned to the BOTTOM, beneath the content: section
 * buttons on the left, audio inputs + language on the right. Icon-only
 * tactile studio buttons, sharing StudioButton + the active-section
 * detector with the desktop rails.
 *
 * Section presses fire a manual wave pulse when audio is off.
 */
export function ConsolePanel() {
  const { active, handleSection } = useSectionNav();
  const { lang } = useLanguage();
  const c = dict(lang).console;
  const nav = dict(lang).nav;
  const { musicOn, micOn, musicStatus, toggleMusic, toggleMic } = useAudio();

  return (
    <motion.div
      aria-label="Konsole"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 1.2, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pointer-events-auto px-[var(--gutter)] pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 select-none"
    >
      <div className="flex items-center justify-between gap-3 overflow-x-auto">
        <div className="console-group flex items-center gap-2">
          {SECTIONS.map((s) => {
            const Icon = s.icon;
            const isActive = active === s.id;
            return (
              <StudioButton
                key={s.id}
                active={isActive}
                size={42}
                onClick={handleSection(s.id)}
                ariaLabel={nav[s.id as keyof Dict["nav"]] ?? s.label}
                ariaCurrent={isActive}
              >
                <Icon size={17} weight={isActive ? "fill" : "regular"} />
              </StudioButton>
            );
          })}
        </div>

        <div className="flex items-center gap-2.5">
          <div
            role="group"
            aria-label="Audioquellen"
            className="console-group flex items-center gap-2"
          >
            <StudioButton
              active={musicOn}
              tone="play"
              dot
              size={42}
              disabled={musicStatus === "unavailable"}
              onClick={toggleMusic}
              ariaLabel={
                musicStatus === "unavailable" ? c.musicUnavailable : c.music
              }
            >
              {musicOn ? (
                <Pause size={17} weight="fill" />
              ) : (
                <Play size={17} weight="fill" />
              )}
            </StudioButton>
            <StudioButton
              active={micOn}
              tone="rec"
              dot
              size={42}
              onClick={toggleMic}
              ariaLabel={c.mic}
            >
              <Microphone size={19} weight={micOn ? "fill" : "regular"} />
            </StudioButton>
          </div>
          <div
            role="group"
            aria-label="Einstellungen"
            className="console-group flex items-center gap-2"
          >
            <ThemeToggle iconSize={17} />
            <LanguageToggle iconSize={17} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
