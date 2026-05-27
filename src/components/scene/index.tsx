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
import { useMemo } from "react";
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
 *   - ToneMapping (ACES) — filmic highlight roll-off (no clip)
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

  if (skip) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
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
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ background: "#000000" }}
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

          {/* Bloom — selective per the audit. Threshold raised so
              only the BRIGHTEST contour peaks bloom (not the entire
              field). intensity 1.3 -> 0.8, threshold 0.025 -> 0.18,
              kernel HUGE -> LARGE. Result: lines stay crisp, brightest
              crests get a soft glow halo. */}
          <Bloom
            intensity={0.8}
            kernelSize={KernelSize.LARGE}
            luminanceThreshold={0.18}
            luminanceSmoothing={0.4}
            mipmapBlur
            blendFunction={BlendFunction.SCREEN}
          />

          {/* ToneMapping (ACES filmic) AFTER bloom — gives bright
              bloom peaks a filmic shoulder so they don't clip to
              flat white. Standard cinematic move. */}
          <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />

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

          {/* Vignette — restrained per audit. darkness 0.5 -> 0.3 so
              corners darken without crushing to true black. */}
          <Vignette
            offset={0.4}
            darkness={0.3}
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
