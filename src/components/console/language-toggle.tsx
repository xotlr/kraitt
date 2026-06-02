"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlagAT, FlagGB } from "@/components/console/flags";
import { StudioButton } from "@/components/console/studio-button";
import { useLanguage } from "@/lib/language-context";
import { dict } from "@/lib/i18n";
import { EASE } from "@/lib/motion";

/**
 * LanguageToggle — the DE/EN switch as a console button showing the
 * active language's FLAG: Austrian (red-white-red) for German, British
 * (Union Jack) for English. Pressing it ROLLS the flag over vertically —
 * the old flag slides up and out, the new one rises in from below, like a
 * flip-board / odometer roll. A clip mask hides the flags outside the cap so
 * they appear to roll through a slot. The flag carries its own colours, so
 * the button stays a neutral black cap.
 */
export function LanguageToggle({
  iconSize = 20,
  shortcut,
  quiet = false,
}: {
  iconSize?: number;
  shortcut?: string;
  /** Desaturate the flag at rest so it reads as a quiet engraved chip, not a
   *  full-colour sticker. Used on the mobile control bar to calm its colour;
   *  full colour returns on hover/focus. Desktop keeps the full flag. */
  quiet?: boolean;
}) {
  const { lang, toggle } = useLanguage();

  return (
    <StudioButton
      shortcut={shortcut}
      onClick={toggle}
      ariaLabel={dict(lang).console.language(lang.toUpperCase())}
    >
      {/* Clip slot: flags roll through this; overflow-hidden + sized to the
          flag so the entering/exiting flag is masked above and below. */}
      <span
        className={
          "relative inline-flex items-center justify-center overflow-hidden transition-[filter] duration-300" +
          (quiet
            ? " [filter:saturate(0.32)_brightness(0.9)] group-hover:[filter:saturate(1)_brightness(1)]"
            : "")
        }
        style={{ width: iconSize, height: iconSize }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={lang}
            initial={{ y: "-110%", opacity: 0 }}
            animate={{ y: "0%", opacity: 1 }}
            exit={{ y: "110%", opacity: 0 }}
            transition={{ duration: 0.34, ease: EASE }}
            className="absolute inline-flex"
          >
            {lang === "de" ? (
              <FlagAT size={iconSize} />
            ) : (
              <FlagGB size={iconSize} />
            )}
          </motion.span>
        </AnimatePresence>
      </span>
    </StudioButton>
  );
}
