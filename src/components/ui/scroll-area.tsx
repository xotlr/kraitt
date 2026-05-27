"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shadcn-style ScrollArea built on Radix. Styled to match the site's
 * monochrome system: hairline-thin track, ink-faint thumb that lifts on
 * hover. The track is invisible until needed (auto type), so quiet pages
 * don't carry visual scrollbar noise.
 *
 * Forwarding the viewport ref is non-trivial: Radix doesn't expose it on
 * Root, so we accept a `viewportRef` prop and forward it onto the
 * Viewport element. Consumers that drive scroll-linked behavior (the
 * shader, the nav observer) need this ref.
 */
const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportClassName?: string;
  }
>(({ className, children, viewportRef, viewportClassName, ...props }, ref) => (
  <ScrollAreaPrimitive.Root
    ref={ref}
    className={cn("relative overflow-hidden", className)}
    {...props}
  >
    <ScrollAreaPrimitive.Viewport
      ref={viewportRef}
      className={cn("h-full w-full", viewportClassName)}
    >
      {children}
    </ScrollAreaPrimitive.Viewport>
    <ScrollBar />
    <ScrollAreaPrimitive.Corner />
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

const ScrollBar = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>,
  React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>
>(({ className, orientation = "vertical", ...props }, ref) => (
  <ScrollAreaPrimitive.ScrollAreaScrollbar
    ref={ref}
    orientation={orientation}
    className={cn(
      "flex touch-none select-none transition-opacity duration-300",
      "data-[state=hidden]:opacity-0",
      orientation === "vertical" &&
        "h-full w-2 border-l border-transparent py-px",
      orientation === "horizontal" &&
        "h-2 flex-col border-t border-transparent px-px",
      className
    )}
    {...props}
  >
    <ScrollAreaPrimitive.ScrollAreaThumb
      className={cn(
        "relative flex-1 rounded-full bg-ink-faint/60 transition-colors duration-300",
        "hover:bg-ink-muted"
      )}
    />
  </ScrollAreaPrimitive.ScrollAreaScrollbar>
));
ScrollBar.displayName = ScrollAreaPrimitive.ScrollAreaScrollbar.displayName;

export { ScrollArea, ScrollBar };
