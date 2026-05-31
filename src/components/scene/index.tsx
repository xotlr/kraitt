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
import { Terrain } from "./terrain";

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
export function Scene() {
  const { tier, reducedMotion } = useDeviceCapability();
  const skip = tier === "low";

  const dpr = useMemo<[number, number] | number>(() => {
    if (typeof window === "undefined") return 1;
    return window.innerWidth < 1024 ? 1 : [1, 1.5];
  }, []);

  // Pause rendering when the tab is backgrounded. r3f keeps running rAF in a
  // hidden tab otherwise, burning GPU/battery on a scene nobody can see. We
  // flip frameloop to "demand" (holds the last frame, no rAF) while hidden
  // and restore it on return. Restoring to "always" unless reduced-motion,
  // which always wants "demand". (CLAUDE.md §3 — previously NOT ENFORCED.)
  const [tabHidden, setTabHidden] = useState(false);
  useEffect(() => {
    const onVisibility = () => setTabHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    onVisibility(); // sync initial state (e.g. mounted in a bg tab)
    return () =>
      document.removeEventListener("visibilitychange", onVisibility);
  }, []);
  const frameloop: "always" | "demand" =
    reducedMotion || tabHidden ? "demand" : "always";

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
        onCreated={({ camera }) => {
          camera.lookAt(0, -0.2, -2.5);
        }}
        frameloop={frameloop}
        // Token, not hardcoded black, so the canvas clear matches the
        // theme during the load gap before the atmosphere mesh paints.
        style={{ background: "var(--color-canvas)" }}
      >
        <Atmosphere />
        <Terrain />
        <CameraRig />

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
            offset={new THREE.Vector2(0.0015, 0.0015)}
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
