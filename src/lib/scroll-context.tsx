"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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
 * Live scroll progress (0..1) off the ScrollArea viewport, throttled to one
 * rAF per scroll burst — the single source of the `scrollTop / (scrollHeight -
 * clientHeight)` math the gauge and the camera both need. Returns a ref so a
 * useFrame/rAF reader can poll it without re-rendering; pass `onChange` to also
 * be called each update (e.g. to drive React state). No work runs while the
 * page isn't scrolling, so this respects the frame-budget gates.
 *
 * `onChange` is held in a ref, so callers may pass an inline closure without
 * re-subscribing the listener every render.
 */
export function useScrollProgress(
  onChange?: (progress: number) => void
): RefObject<number> {
  const viewportRef = useScrollViewport();
  const progress = useRef(0);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;

    let raf: number | null = null;
    const read = () => {
      raf = null;
      const max = vp.scrollHeight - vp.clientHeight;
      const p = max > 0 ? vp.scrollTop / max : 0;
      progress.current = p;
      onChangeRef.current?.(p);
    };
    const onScroll = () => {
      if (raf == null) raf = requestAnimationFrame(read);
    };

    read();
    vp.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      vp.removeEventListener("scroll", onScroll);
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, [viewportRef]);

  return progress;
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
