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
 * Theme state for the light/dark console switch.
 *
 * The site is dark-first (OLED black is the brand). Light mode overrides
 * the CSS custom-property palette under `html.light` (see globals.css)
 * and the shader reads `theme` to flip its background + contour colours.
 *
 * Persisted to localStorage; sets/removes the `light` class on <html>.
 * A ref-style snapshot isn't needed — the shader reads `theme` via a
 * normal subscription (it changes rarely, unlike audio levels).
 */
export type Theme = "dark" | "light";

interface ThemeState {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeState | null>(null);
const STORAGE_KEY = "sk-theme";

function readStoredTheme(): Theme {
  // Client-only initializer (mirrors language-context). The layout's no-flash
  // script already applies the `light` CLASS pre-paint; reading the stored
  // value here means the React `theme` state — which the shader subscribes to
  // for its background/contour colours — also starts correct, so the scene
  // doesn't morph dark→light after hydration for a returning light-mode user.
  if (typeof window === "undefined") return "dark";
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved === "dark" || saved === "light") return saved;
  } catch {
    // localStorage unavailable — fall through to the dark default.
  }
  return "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);

  useEffect(() => {
    document.documentElement.classList.toggle("light", theme === "light");
    try {
      window.localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // ignore storage failures
    }
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const toggle = useCallback(
    () => setThemeState((t) => (t === "dark" ? "light" : "dark")),
    []
  );

  const value = useMemo(
    () => ({ theme, setTheme, toggle }),
    [theme, setTheme, toggle]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
