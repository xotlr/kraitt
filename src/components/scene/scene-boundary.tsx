"use client";

import { Component, type ReactNode } from "react";

/**
 * SceneBoundary — error boundary around the WebGL scene.
 *
 * The scene is the one part of the page that can fail at runtime on a user's
 * machine for reasons we can't predict: a shader that won't compile on some
 * mobile GPU driver, a lost WebGL context the renderer can't recover, an
 * out-of-memory on a weak device. Without a boundary, any of those throws up
 * through React and blanks the whole page — the content, the console, all of
 * it — because the scene is mounted high in the tree.
 *
 * Here we contain that blast radius: if the scene throws, we render nothing in
 * its place. The site degrades to exactly the no-scene state it already
 * supports for low-end devices (the bezel + content remain; the canvas slot is
 * just empty), instead of taking the page down with it.
 *
 * This is a class component because React error boundaries have no hook form.
 */
export class SceneBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    // Surface once for debugging; not user-facing. The fallback (no scene) is
    // the message — a portfolio doesn't need a "3D failed" banner.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error("[scene] render failed, falling back to no-scene:", error);
    }
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}
