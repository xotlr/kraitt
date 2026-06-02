"use client";

import { Moon, Sun } from "@phosphor-icons/react";
import { AnimatePresence, motion } from "framer-motion";
import { StudioButton } from "@/components/console/studio-button";
import { useTheme } from "@/lib/theme-context";
import { EASE } from "@/lib/motion";

/**
 * ThemeToggle — the light/dark switch as a console button. Shows a Moon
 * in dark mode, a Sun in light, swapping with a crossfade + small rotate
 * (the moneypower / screenwriter sun-moon pattern). The icon is the
 * active amber so it reads as a lit control regardless of mode.
 */
export function ThemeToggle({ iconSize = 20 }: { iconSize?: number }) {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";

  return (
    <StudioButton
      active
      latch={false}
      onClick={toggle}
      ariaLabel={dark ? "Helles Design einschalten" : "Dunkles Design einschalten"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -40, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 40, scale: 0.7 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="inline-flex"
        >
          {dark ? (
            <Moon size={iconSize} weight="fill" />
          ) : (
            <Sun size={iconSize} weight="fill" />
          )}
        </motion.span>
      </AnimatePresence>
    </StudioButton>
  );
}
