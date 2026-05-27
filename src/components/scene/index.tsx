"use client";

import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useMemo } from "react";
import * as THREE from "three";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { Vines } from "./vines";

/**
 * Scene — the unified r3f canvas. Composes:
 *   1. dim warm atmosphere (noise plane drawn first, full screen)
 *   2. gold vine tapestry (TubeGeometries with emissive material)
 *   3. EffectComposer with UnrealBloom — the bloom is what makes the
 *      emissive vines read as *lit* gold instead of yellow plastic.
 *      Bright pixels bleed outward and mix with the noise pass, so the
 *      vines feel embedded in the warm field rather than layered on top.
 *
 * Tonemapping is ACES filmic with tuned exposure so highlights roll off
 * cinematically. Output color space SRGB.
 */
export function Scene() {
  const { tier, reducedMotion } = useDeviceCapability();
  const skip = tier === "low";

  const dpr = useMemo<[number, number] | number>(() => {
    if (typeof window === "undefined") return 1;
    return window.innerWidth < 1024 ? 1 : [1, 1.75];
  }, []);

  if (skip) return null;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10">
      <Canvas
        dpr={dpr}
        gl={{
          antialias: false, // bloom hides aliasing, save the fragment cost
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          // Exposure tuned so the emissive vines bloom but the noise
          // bed stays dim. Lower = more cinematic highlight roll-off.
          gl.toneMappingExposure = 0.95;
        }}
        camera={{
          position: [0, 0, 2.4],
          fov: 45,
          near: 0.1,
          far: 50,
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ background: "#000000" }}
      >
        {/* Warm rim + faint counter-fill. The rim direction is what gives
            the gold tubes their "lit from above" quality; the counter
            keeps the back of each tube from going dead black. */}
        <ambientLight intensity={0.4} color="#3a2618" />
        <directionalLight
          position={[3, 4, 2]}
          intensity={2.4}
          color="#ffd9a8"
        />
        <directionalLight
          position={[-2, -1, 1]}
          intensity={0.6}
          color="#b87a3a"
        />

        <Atmosphere />
        <Vines />

        <EffectComposer multisampling={0}>
          {/* UnrealBloom: anything brighter than threshold gets soft glow
              applied. We keep threshold low so the emissive gold catches
              even when toned. Intensity is the brightness of the glow,
              luminanceSmoothing softens the threshold edge so the bloom
              doesn't pop in at a hard cutoff. */}
          <Bloom
            intensity={1.0}
            kernelSize={KernelSize.HUGE}
            luminanceThreshold={0.3}
            luminanceSmoothing={0.7}
            mipmapBlur
            blendFunction={BlendFunction.SCREEN}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
