"use client";

import { useEffect } from "react";
import { SECTIONS } from "@/components/console/controls";
import { useAudio } from "@/lib/audio";
import { useTheme } from "@/lib/theme-context";
import { useLanguage } from "@/lib/language-context";
import { useScrollTo } from "@/lib/scroll-context";

/**
 * useConsoleHotkeys — wires the desk's keyboard shortcuts, the ones shown as
 * <kbd> chips on the StudioButtons.
 *
 *   ⌘P  play / pause        ⌘M  mic         ⌘S  mute
 *   ⌘T  theme               ⌘L  language     1–5  jump to section
 *
 * The ⌘-combos shadow browser defaults (⌘P print, ⌘T new tab, ⌘L address bar,
 * ⌘S save), so we preventDefault on a match to claim them for the app while
 * focus is on the page. Plain 1–5 fire only when the user ISN'T typing in a
 * field (so they don't hijack form input — there are no inputs today, but this
 * keeps the guard honest). Mount once, near the providers.
 */
export function useConsoleHotkeys() {
  const { toggleMusic, toggleMic, toggleMute } = useAudio();
  const { toggle: toggleTheme } = useTheme();
  const { toggle: toggleLang } = useLanguage();
  const scrollTo = useScrollTo();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in an editable field.
      const t = e.target as HTMLElement | null;
      if (
        t &&
        (t.isContentEditable ||
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.tagName === "SELECT")
      ) {
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case "p":
            e.preventDefault();
            void toggleMusic();
            return;
          case "m":
            e.preventDefault();
            void toggleMic();
            return;
          case "s":
            e.preventDefault();
            toggleMute();
            return;
          case "t":
            e.preventDefault();
            toggleTheme();
            return;
          case "l":
            e.preventDefault();
            toggleLang();
            return;
        }
        return;
      }

      // Plain number keys 1–5 jump to the corresponding section. No modifier so
      // they read as quick nav; guarded above against field input.
      if (!mod && !e.altKey && e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const section = SECTIONS[idx];
        if (section) {
          e.preventDefault();
          // scrollTo returns a click handler; invoke it with a synthetic-ish
          // event-less call. The handler only uses preventDefault if given one.
          scrollTo(section.id)({ preventDefault: () => {} } as React.MouseEvent);
        }
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleMusic, toggleMic, toggleMute, toggleTheme, toggleLang, scrollTo]);
}
