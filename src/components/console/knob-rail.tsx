"use client";

import {
  Microphone,
  Pause,
  Play,
  SpeakerSimpleHigh,
  SpeakerSimpleSlash,
} from "@phosphor-icons/react";
import { motion, type Variants } from "framer-motion";
import { SECTIONS } from "@/components/console/controls";
import { LanguageToggle } from "@/components/console/language-toggle";
import { StudioButton } from "@/components/console/studio-button";
import { ThemeToggle } from "@/components/console/theme-toggle";
import { useActiveSection } from "@/components/console/use-active-section";
import { useAudio } from "@/lib/audio";
import { useScrollTo } from "@/lib/scroll-context";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import type { Dict } from "@/lib/i18n";

/**
 * KnobRail — the RIGHT console column: ALL the tactile controls. The LEFT
 * rail is the metering instrument (VU + fader + meter + EQ); everything you
 * click lives here. Top to bottom: the brand plate, the section nav, the
 * audio transport (play/mic/mute), and the site settings (theme/language).
 *
 * Section presses fire a manual wave pulse when no audio source is playing,
 * so the desk visibly drives the signal even in silence.
 *
 * lg+ only; below lg the bottom ConsolePanel takes over.
 */
const rail: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.5 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: 14 },
  show: { opacity: 1, x: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

export function KnobRail() {
  const active = useActiveSection();
  const scrollTo = useScrollTo();
  const { lang } = useLanguage();
  const c = dict(lang).console;
  const nav = dict(lang).nav;
  const { musicOn, micOn, musicStatus, muted, toggleMute, toggleMusic, toggleMic, triggerPulse } =
    useAudio();
  const audioOff = !musicOn && !micOn;

  const handleSection =
    (id: string): React.MouseEventHandler<HTMLButtonElement> =>
    (e) => {
      if (audioOff) triggerPulse();
      scrollTo(id)(e);
    };

  return (
    <motion.div
      variants={rail}
      initial="hidden"
      animate="show"
      className="hidden lg:flex shrink-0 flex-col items-center justify-between gap-3 select-none"
      style={{
        width: "var(--console-rail-w)",
        paddingTop: "var(--console-rail-inset)",
        paddingBottom: "var(--console-rail-inset)",
      }}
    >
      {/* TOP — brand plate + audio transport directly beneath it. */}
      <div className="flex flex-col items-center gap-3">
        {/* Brand plate — the wordmark, the desk's name tag. Same recessed
            pill as the clusters; links home. */}
        <motion.div variants={item} className="console-group">
          <a
            href="#hero"
            onClick={scrollTo("hero")}
            className="flex items-center justify-center font-display text-sm leading-none text-ink-muted hover:text-ink transition-colors"
            style={{ width: "var(--console-unit)", height: "var(--console-unit)" }}
          >
            sk
          </a>
        </motion.div>

        {/* Audio sources / transport — play-pause, mic, master mute, tucked
            under the brand. Colour-coded: green transport, red mic/mute. */}
        <motion.div
          variants={item}
          role="group"
          aria-label="Audioquellen"
          className="console-group flex flex-col items-center gap-1.5"
        >
          <StudioButton
            active={musicOn}
            tone="play"
            dot
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
            onClick={toggleMic}
            ariaLabel={c.mic}
          >
            <Microphone size={19} weight={micOn ? "fill" : "regular"} />
          </StudioButton>
          {/* Master mute — kills output without moving the fader, latches red. */}
          <StudioButton
            active={muted}
            tone="rec"
            dot
            onClick={toggleMute}
            ariaLabel={muted ? c.unmute : c.mute}
          >
            {muted ? (
              <SpeakerSimpleSlash size={18} weight="fill" />
            ) : (
              <SpeakerSimpleHigh size={18} weight="regular" />
            )}
          </StudioButton>
        </motion.div>
      </div>

      {/* MIDDLE — section navigation, centred between the transport above and
          the settings below (justify-between spaces the three zones out). */}
      <nav aria-label="Sektionen" className="console-group flex flex-col items-center gap-1.5">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isActive = active === s.id;
          return (
            <motion.div key={s.id} variants={item}>
              <StudioButton
                active={isActive}
                dot
                onClick={handleSection(s.id)}
                ariaLabel={nav[s.id as keyof Dict["nav"]] ?? s.label}
                ariaCurrent={isActive}
              >
                <Icon size={18} weight={isActive ? "fill" : "regular"} />
              </StudioButton>
            </motion.div>
          );
        })}
      </nav>

      {/* BOTTOM — theme + language, site controls (NOT navigation). */}
      <motion.div
        variants={item}
        role="group"
        aria-label="Einstellungen"
        className="console-group flex flex-col items-center gap-1.5"
      >
        <ThemeToggle iconSize={18} />
        <LanguageToggle iconSize={18} />
      </motion.div>
    </motion.div>
  );
}
