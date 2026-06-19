"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { WebGPURenderer } from "three/webgpu";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { CameraRig } from "./camera-rig";
import { FrameCap } from "./frame-cap";
import { PostFxPipeline } from "./post-processing";
import { SceneBoundary } from "./scene-boundary";
import { Terrain } from "./terrain";

/**
 * Scene composition:
 *   1. Atmosphere — fullscreen OLED-black backdrop
 *   2. Terrain — 3D plane with vertex-displaced audio-reactive waves
 *   3. CameraRig — scroll-driven dolly
 *   4. PostFxPipeline — the WebGPU node-graph cinematic stack
 *
 * Renderer: WebGPU (three's WebGPURenderer). It auto-falls-back to WebGL2 when
 * WebGPU is unavailable (forceWebGL stays false), so the scene runs everywhere
 * the old WebGL build did — the difference is lower CPU/draw-call overhead and
 * an async render path on capable browsers. The shaders are authored in TSL
 * (terrain.tsx / atmosphere.tsx) and the post stack as display nodes
 * (post-processing.tsx) — both renderer-native, no GLSL-string composer.
 *
 * Post-processing order (unchanged from the old EffectComposer tuning):
 *   Bloom (selective crests) → ChromaticAberration → SMAA → AgX tone map
 *   → HueSaturation → Vignette.
 */
function SceneImpl() {
  const { tier, reducedMotion } = useDeviceCapability();
  const skip = tier === "low";

  // If the GPU drops the context and the renderer can't restore it, surface a
  // render error so SceneBoundary swaps to the no-scene fallback instead of a
  // frozen/blank canvas. Set by the contextlost handler wired in onCreated.
  const [contextLost, setContextLost] = useState(false);
  if (contextLost) throw new Error("GPU context lost");

  // Track the mobile breakpoint live (DevTools docking, external monitor,
  // tablet rotation must re-derive the DPR + frame caps). SSR defaults desktop.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Desktop DPR up to 2 (true Retina/4K: sharper contours + post FX). Mobile
  // stays at 1 (the perf gate). r3f clamps the upper bound to the display's
  // real devicePixelRatio, so a 1080p screen never pays for 2x.
  const dpr = useMemo<[number, number] | number>(
    () => (isMobile ? 1 : [1, 2]),
    [isMobile]
  );

  // Pause rendering when the tab is backgrounded.
  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility();
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The Canvas always runs in "demand": nothing renders unless invalidate() is
  // called. FrameCap is the only caller, pumping at a fixed FPS — so the loop
  // is frame-capped to 30 (desktop) / 20 (mobile). fps=null (reduced-motion or
  // hidden tab) means no pump runs and the scene holds its last frame.
  const capFps: number | null =
    reducedMotion || tabHidden ? null : isMobile ? 20 : 30;

  if (skip) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        dpr={dpr}
        // Async gl factory: build + init a WebGPURenderer (r3f 9 awaits a
        // Promise<Renderer> here). forceWebGL:false lets it use WebGPU when
        // available and fall back to WebGL2 otherwise. antialias is off — SMAA
        // in the post stack does the line AA; MSAA on top would be wasted cost.
        gl={async (props) => {
          const renderer = new WebGPURenderer({
            canvas: props.canvas as HTMLCanvasElement,
            antialias: false,
            alpha: false,
            powerPreference: "high-performance",
            forceWebGL: false,
          });
          await renderer.init();
          return renderer;
        }}
        camera={{
          position: [0, 0.8, 3.5],
          fov: 55,
          near: 0.1,
          far: 30,
        }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, -0.2, -2.5);
          // A lost context that doesn't restore would freeze on the last frame
          // with no signal. preventDefault lets the browser attempt recovery;
          // if it never restores, trip the boundary so the page degrades to
          // the no-scene state. WebGPURenderer surfaces this as the same
          // canvas-level event in its WebGL2 fallback path; the WebGPU path
          // dispatches an uncaptured-error we also map to the boundary.
          const canvas = gl.domElement;
          canvas.addEventListener(
            "webglcontextlost",
            (e) => {
              e.preventDefault();
              setContextLost(true);
            },
            { once: true }
          );
        }}
        frameloop="demand"
        // Token, not hardcoded black, so the canvas clear matches the theme
        // during the load gap before the atmosphere mesh paints.
        style={{ background: "var(--color-canvas)" }}
      >
        <Atmosphere />
        <Terrain />
        <CameraRig />
        <FrameCap fps={capFps} />
        <PostFxPipeline />
      </Canvas>
    </div>
  );
}

/**
 * Scene — the public entry. Wraps the renderer in an error boundary so a
 * shader-compile failure or an unrecoverable lost context degrades to the
 * no-scene state instead of blanking the page.
 */
export function Scene() {
  return (
    <SceneBoundary>
      <SceneImpl />
    </SceneBoundary>
  );
}
