"use client";

import { type ReactNode } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useScrollViewport } from "@/lib/scroll-context";

/**
 * The page's primary scroll container. Provides the styled scrollbar
 * and registers the viewport ref into ScrollContext so the shader
 * (strings.tsx) and nav observer can read scroll from this element
 * instead of the window.
 *
 * Sized to 100svh so the viewport fills exactly one screen and Radix
 * has a measurable height to compute thumb size from.
 */
export function PageScroll({ children }: { children: ReactNode }) {
  const viewportRef = useScrollViewport();
  // CA filter is applied via the `.ca-text` class in page.tsx /
  // sections, NOT here on the scroll wrapper. Earlier we wrapped the
  // whole scroll content in `filter: url(#ca)`, but CSS filter
  // creates a new containing block which broke position:fixed on the
  // Nav (the nav lives inside this scroll content). Scoping the
  // filter to the body sections only lets the Nav stay fixed to the
  // viewport.
  return (
    <ScrollArea className="h-svh" viewportRef={viewportRef}>
      {children}
    </ScrollArea>
  );
}
