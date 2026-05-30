"use client";

import { AnimatePresence, motion } from "framer-motion";
import { FlagAT, FlagGB } from "@/components/console/flags";
import { StudioButton } from "@/components/console/studio-button";
import { useLanguage } from "@/lib/language-context";

/**
 * LanguageToggle — the DE/EN switch as a console button showing the
 * active language's FLAG: Austrian (red-white-red) for German, British
 * (Union Jack) for English. Pressing it swaps the flag with a clean
 * crossfade (no flip). The flag carries its own colours, so the button
 * stays a neutral black cap.
 */
export function LanguageToggle({ iconSize = 20 }: { iconSize?: number }) {
  const { lang, toggle } = useLanguage();

  return (
    <StudioButton
      onClick={toggle}
      ariaLabel={`Sprache: ${lang.toUpperCase()} — umschalten`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={lang}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="inline-flex"
        >
          {lang === "de" ? (
            <FlagAT size={iconSize} />
          ) : (
            <FlagGB size={iconSize} />
          )}
        </motion.span>
      </AnimatePresence>
    </StudioButton>
  );
}
