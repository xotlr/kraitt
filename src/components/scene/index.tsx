"use client";

import { Canvas } from "@react-three/fiber";
import { Bloom, EffectComposer } from "@react-three/postprocessing";
import { BlendFunction, KernelSize } from "postprocessing";
import { useMemo } from "react";
import * as THREE from "three";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { CameraRig } from "./camera-rig";
import { Terrain } from "./terrain";

/**
 * Scene composition:
 *   1. Atmosphere — fullscreen OLED-black backdrop + film grain
 *   2. Terrain — 3D plane with vertex-displaced FBM, fragment-drawn
 *      gold contour lines. Real perspective camera tilted ~17° down
 *      so the field reads as a landscape receding into the distance.
 *
 * The atmosphere uses its own bypassed camera (full-screen quad with
 * gl_Position written directly). The terrain uses the regular Three
 * camera. They compose because the atmosphere renders first
 * (renderOrder=-1) and the terrain alpha-blends on top.
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
          toneMapping: THREE.NoToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        camera={{
          // Camera sits 0.8 wu above the ground, looking 17° down with
          // ~3.5 wu of forward offset. This gives a low landscape
          // framing — horizon in the upper third, terrain stretches
          // into the distance.
          position: [0, 0.8, 3.5],
          fov: 55,
          near: 0.1,
          far: 30,
        }}
        onCreated={({ camera }) => {
          // Tilt camera ~17° down toward a point on the ground ahead.
          camera.lookAt(0, -0.2, -2.5);
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ background: "#000000" }}
      >
        <Atmosphere />
        <Terrain />
        <CameraRig />

        {/* Bloom is the "colorful gaussian blur" that makes the
            terrain lines glow softly instead of reading as crisp
            wireframe. Threshold is low (0.05) so the cool-cream
            lines pick up bloom even at default brightness. Kernel
            HUGE for soft, hazy spread. Intensity moderate. */}
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.55}
            kernelSize={KernelSize.HUGE}
            luminanceThreshold={0.05}
            luminanceSmoothing={0.7}
            mipmapBlur
            blendFunction={BlendFunction.SCREEN}
          />
        </EffectComposer>
      </Canvas>
    </div>
  );
}
