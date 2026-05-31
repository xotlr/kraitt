"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Language state for the console's DE/EN toggle.
 *
 * Holds and persists the selected language and keeps <html lang> in sync.
 * Section copy is translated: components read `lang` here and pull their
 * strings from src/lib/i18n.ts (the DICT keyed by Lang). The toggle is a
 * real control that swaps the whole site's copy, not just a label.
 */
export type Lang = "de" | "en";

interface LanguageState {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

const LanguageContext = createContext<LanguageState | null>(null);
const STORAGE_KEY = "sk-lang";

export function LanguageProvider({ children }: { children: ReactNode }) {
  // SSR has no access to the visitor's choice, so the server (and thus the
  // FIRST client render, for hydration parity) must use the "de" default.
  // Reading localStorage in a useState initializer instead would make the
  // first client render emit EN markup while the server emitted DE — a real
  // hydration mismatch on every translated string. So the stored language is
  // applied in a mount effect: a returning EN visitor sees one DE→EN paint.
  // That residual flash is the honest cost of static i18n; eliminating it
  // fully needs the server to know the preference (a cookie + a server
  // component reading it), which is deferred — it's disproportionate coupling
  // for a portfolio. The <html lang> attribute IS corrected pre-paint by the
  // no-flash script in layout.tsx, so assistive tech reads the right language
  // from the first frame even though the visible copy swaps once.
  const [lang, setLangState] = useState<Lang>("de");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "de" || saved === "en") setLangState(saved);
    } catch {
      // localStorage unavailable — keep the default.
    }
  }, []);

  // Keep <html lang> + storage in sync whenever it changes.
  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore storage failures
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggle = useCallback(
    () => setLangState((l) => (l === "de" ? "en" : "de")),
    []
  );

  const value = useMemo(
    () => ({ lang, setLang, toggle }),
    [lang, setLang, toggle]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error("useLanguage must be used inside LanguageProvider");
  return ctx;
}
