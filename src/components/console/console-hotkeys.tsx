"use client";

import { useConsoleHotkeys } from "@/hooks/use-console-hotkeys";

/**
 * ConsoleHotkeys — mounts the desk's global keyboard shortcuts (see
 * useConsoleHotkeys). Renders nothing; it exists so the hook runs inside the
 * audio/theme/language/scroll providers without coupling the bindings to any
 * one visible component (the rails are desktop-only, but the shortcuts work at
 * every width).
 */
export function ConsoleHotkeys() {
  useConsoleHotkeys();
  return null;
}
