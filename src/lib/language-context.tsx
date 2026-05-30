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
 * Lightweight language state for the console's DE/EN toggle.
 *
 * SCOPE NOTE (honest): this holds and persists the selected language and
 * keeps <html lang> in sync, so the toggle is a real, functional control
 * — not a fake switch. It does NOT yet translate section copy; the site's
 * content is currently hardcoded German in the section components and
 * src/data. Wiring each string to `lang` is a separate content pass.
 * The context is the seam that pass will plug into (read `lang`, branch
 * copy), so adding it now is the right order of operations rather than
 * scope creep.
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
  const [lang, setLangState] = useState<Lang>("de");

  // Restore persisted choice on mount.
  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "de" || saved === "en") setLangState(saved);
  }, []);

  // Keep <html lang> + storage in sync whenever it changes.
  useEffect(() => {
    document.documentElement.lang = lang;
    window.localStorage.setItem(STORAGE_KEY, lang);
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
