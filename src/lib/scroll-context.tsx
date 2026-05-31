"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/**
 * Shares the ScrollArea viewport element with anything that wants to
 * read scroll progress or use it as an IntersectionObserver root.
 *
 * Why a context: window.scrollY no longer reflects page scroll once we
 * wrap <main> in a Radix ScrollArea (Radix scrolls a child div instead),
 * so the shader and nav observer need a different source of truth. We
 * pass the ref rather than the value so subscribers can attach their
 * own listeners or pass it to IntersectionObserver as `root`.
 */
type ScrollContextValue = {
  viewportRef: RefObject<HTMLDivElement | null>;
};

const ScrollContext = createContext<ScrollContextValue | null>(null);

export function ScrollProvider({ children }: { children: ReactNode }) {
  const viewportRef = useRef<HTMLDivElement | null>(null);
  return (
    <ScrollContext.Provider value={{ viewportRef }}>
      {children}
    </ScrollContext.Provider>
  );
}

export function useScrollViewport(): RefObject<HTMLDivElement | null> {
  const ctx = useContext(ScrollContext);
  if (!ctx) {
    throw new Error("useScrollViewport must be used inside ScrollProvider");
  }
  return ctx.viewportRef;
}

/**
 * Returns a click handler that scrolls the ScrollArea viewport to an
 * element by id. Use for in-page anchor links — the native href="#id"
 * behavior targets window, which is no longer the scroll container.
 */
export function useScrollTo() {
  const viewportRef = useScrollViewport();
  // Memoized so call sites can use it in deps / pass it down without
  // allocating a fresh handler factory every render. viewportRef identity is
  // stable (a context ref), so the empty-ish dep list is correct.
  return useCallback(
    (id: string) => (e: React.MouseEvent) => {
      e.preventDefault();
      const root = viewportRef.current;
      const target = document.getElementById(id);
      if (!root || !target) return;
      root.scrollTo({ top: target.offsetTop, behavior: "smooth" });
    },
    [viewportRef]
  );
}
