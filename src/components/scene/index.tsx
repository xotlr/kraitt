"use client";

import { Canvas } from "@react-three/fiber";
import {
  Bloom,
  ChromaticAberration,
  EffectComposer,
  HueSaturation,
  SMAA,
  ToneMapping,
  Vignette,
} from "@react-three/postprocessing";
import { BlendFunction, KernelSize, ToneMappingMode } from "postprocessing";
import { useEffect, useMemo, useState } from "react";
import * as THREE from "three";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { CameraRig } from "./camera-rig";
import { FrameCap } from "./frame-cap";
import { SceneBoundary } from "./scene-boundary";
import { Terrain } from "./terrain";

// Hoisted out of JSX so re-renders (tab visibility toggles) don't allocate a
// new Vector2 and re-init the chromatic-aberration pass each time.
const CA_OFFSET = new THREE.Vector2(0.0015, 0.0015);

/**
 * Scene composition:
 *   1. Atmosphere — fullscreen OLED-black backdrop + film grain
 *   2. Terrain — 3D plane with vertex-displaced waves
 *   3. CameraRig — scroll-driven dolly
 *
 * Post-processing stack (tuned per VFX audit):
 *   - SMAA       — line-edge antialiasing (cheap, huge ROI on contours)
 *   - Bloom      — SELECTIVE glow on bright wave crests only
 *   - ToneMapping (AgX) — filmic roll-off with a true black point
 *   - HueSaturation — slight desaturation for film-stock feel
 *   - ChromaticAberration — subtle RGB fringe at edges only
 *   - Vignette   — restrained edge darkening
 *
 * Removed: Noise post pass (was doubling with atmosphere shader grain).
 */
function SceneImpl() {
  const { tier, reducedMotion } = useDeviceCapability();
  const skip = tier === "low";

  // If the GPU drops the WebGL context and the renderer can't restore it, we
  // surface it as a render error so SceneBoundary swaps to the no-scene
  // fallback instead of leaving a frozen/blank canvas. Set by the
  // webglcontextlost handler wired in onCreated.
  const [contextLost, setContextLost] = useState(false);
  if (contextLost) throw new Error("WebGL context lost");

  // Track the mobile breakpoint live, not as a one-shot snapshot — a resize
  // across 1024px (DevTools docking, external monitor, tablet rotation) must
  // re-derive both the DPR cap and the frame-cap. matchMedia matches the
  // breakpoint exactly and fires on change. SSR defaults to desktop.
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(max-width: 1023px)");
    setIsMobile(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Desktop DPR raised 1.5 -> 2 so the scene renders at true Retina/4K
  // resolution: sharper contours, sharper post FX, and crucially FINER film
  // grain (grain cell size is in framebuffer pixels, so a higher framebuffer
  // res = smaller grain on screen). Mobile stays at 1 — the perf gate still
  // holds there, where it matters most. r3f clamps the upper bound to the
  // display's real devicePixelRatio, so a 1080p screen never pays for 2x.
  const dpr = useMemo<[number, number] | number>(
    () => (isMobile ? 1 : [1, 2]),
    [isMobile]
  );

  // Pause rendering when the tab is backgrounded. r3f keeps running rAF in a
  // hidden tab otherwise, burning GPU/battery on a scene nobody can see.
  // (CLAUDE.md §3 — previously NOT ENFORCED.)
  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility(); // sync initial state (e.g. mounted in a bg tab)
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // The Canvas always runs in "demand": nothing renders unless invalidate()
  // is called. FrameCap is the only caller, pumping at a fixed FPS — so the
  // loop is frame-capped to 30 (desktop) / 20 (mobile) instead of the
  // monitor's native rate. When motion should stop entirely (reduced-motion
  // preference, or a hidden tab) we pass fps=null: no pump runs, the scene
  // holds its last painted frame. (CLAUDE.md §3 — frame-cap, previously NOT
  // ENFORCED.)
  const capFps: number | null =
    reducedMotion || tabHidden ? null : isMobile ? 20 : 30;

  if (skip) return null;

  return (
    // Absolute-fills the island card (its positioned, rounded-clipped
    // parent) rather than the viewport, so the signal is visibly
    // CONTAINED by the monitor bezel — the shader is the thing on the
    // screen, the gutter is the matte around it. z-0 sits under content
    // (z-10) but over the card's own background.
    <div className="pointer-events-none absolute inset-0 z-0">
      <Canvas
        dpr={dpr}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          // Renderer tonemapping disabled — we use the ToneMapping
          // EFFECT in the composer instead so it operates on the
          // post-bloom buffer (correct order for filmic highlights).
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          position: [0, 0.8, 3.5],
          fov: 55,
          near: 0.1,
          far: 30,
        }}
        onCreated={({ camera, gl }) => {
          camera.lookAt(0, -0.2, -2.5);
          // A lost context that doesn't restore would otherwise freeze on the
          // last frame with no signal. preventDefault lets the browser attempt
          // restoration; if "webglcontextrestored" never fires, we trip the
          // boundary so the page degrades to the no-scene state.
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
        // Token, not hardcoded black, so the canvas clear matches the
        // theme during the load gap before the atmosphere mesh paints.
        style={{ background: "var(--color-canvas)" }}
      >
        <Atmosphere />
        <Terrain />
        <CameraRig />
        <FrameCap fps={capFps} />

        <EffectComposer multisampling={0}>
          {/* SMAA — subpixel morphological AA. Lines on the terrain
              were shimmering at oblique angles; SMAA is cheap (< 1ms
              at 1080p) and fixes that. Runs before everything else
              so subsequent passes operate on a clean image. */}
          <SMAA />

          {/* Bloom — selective. Threshold keeps the dim surface fill
              (≈0.02–0.23 luminance) and the cold-blue ridge lift BELOW it,
              so only the bright contour crests bloom — bloom the lines, not
              the bed (the OLED black must stay #000). Retuned for the DS
              luminosity pass (§1): now that the contours carry a horizon
              glow, threshold 0.32 -> 0.28 lets the brighter far ridgelines
              bloom into the haze, intensity 0.7 -> 0.9 makes them genuinely
              glow out of near-black. Guard verified against idle + peaks. */}
          <Bloom
            intensity={0.9}
            kernelSize={KernelSize.LARGE}
            luminanceThreshold={0.28}
            luminanceSmoothing={0.25}
            mipmapBlur
            blendFunction={BlendFunction.SCREEN}
          />

          {/* ToneMapping — was ACES_FILMIC, which lifts and desaturates
              near-black (the whole bed crept up to mid-grey). On a brand
              whose identity is literal OLED black that's fatal. Switched to
              a tone curve that preserves black: AgX has a true black point,
              so #000 stays #000 while bright bloom crests still get a
              filmic shoulder instead of clipping flat. */}
          <ToneMapping mode={ToneMappingMode.AGX} />

          {/* Slight desaturation for film-stock feel. -8% saturation
              + a tiny cool hue shift. Very subtle; pushes the warm
              cream lines toward a film-print neutral. */}
          <HueSaturation saturation={-0.08} hue={-0.02} />

          {/* Chromatic aberration — pulled WAY back per audit.
              modulationOffset 0.35 -> 0.6 means the inner 60% of the
              frame stays clean; only the outer ring fringes. Offset
              0.0024 -> 0.0015 reduces the fringe magnitude.
              The DOM-side SVG CA filter no longer exists (it broke
              backdrop-filter edge blur), so this is the only CA. */}
          <ChromaticAberration
            offset={CA_OFFSET}
            radialModulation
            modulationOffset={0.6}
            blendFunction={BlendFunction.NORMAL}
          />

          {/* Vignette — pulled to the corners only. offset 0.4 -> 0.55 so
              the darkened ring starts much further out (the center stays
              untouched), darkness 0.3 -> 0.28. The monitor bezel already
              does most of the edge framing; the vignette was washing a
              dark veil across too much of the frame. */}
          <Vignette
            offset={0.55}
            darkness={0.28}
            blendFunction={BlendFunction.NORMAL}
          />

          {/* No Noise pass — atmosphere shader already does film
              grain procedurally at 2Hz. The OVERLAY post-pass was
              doubling that and shifting hue. Removed. */}
        </EffectComposer>
      </Canvas>
    </div>
  );
}

/**
 * Scene — the public entry. Wraps the WebGL implementation in an error
 * boundary so a shader-compile failure or an unrecoverable lost context
 * degrades to the no-scene state instead of blanking the page.
 */
export function Scene() {
  return (
    <SceneBoundary>
      <SceneImpl />
    </SceneBoundary>
  );
}
