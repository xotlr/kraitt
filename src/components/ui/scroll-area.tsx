"use client";

import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shadcn-style ScrollArea built on Radix. The VISIBLE scrollbar is NOT
 * rendered here — the console's numeric measurement rulers (ScrollGauge,
 * mounted in the island) are the scroll affordance: they show position and
 * the right one scrubs. This component keeps the Radix Root/Viewport purely
 * for scroll mechanics (native wheel/keys, hidden native bars) and to expose
 * the viewport ref the shader / nav observer / gauges read from.
 *
 * Forwarding the viewport ref is non-trivial: Radix doesn't expose it on
 * Root, so we accept a `viewportRef` prop and forward it onto the
 * Viewport element.
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
    {/* A hidden, always-mounted scrollbar. We don't show it (ScrollGauge in the
        island is the visible affordance), but keeping it mounted is what makes
        Radix set overflow:scroll on the viewport so the mouse wheel works. */}
    <ScrollAreaPrimitive.ScrollAreaScrollbar
      orientation="vertical"
      forceMount
      className="pointer-events-none invisible w-0"
    >
      <ScrollAreaPrimitive.ScrollAreaThumb />
    </ScrollAreaPrimitive.ScrollAreaScrollbar>
  </ScrollAreaPrimitive.Root>
));
ScrollArea.displayName = ScrollAreaPrimitive.Root.displayName;

export { ScrollArea };
