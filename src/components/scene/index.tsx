"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { CameraRig } from "./camera-rig";
import { Strings } from "./strings";

/**
 * Scene composition:
 *   1. Atmosphere — OLED-black field with sparse warm pockets + grain
 *   2. Strings — ground-plane horizontal cables, slithering, world-fixed
 *   3. CameraRig — scroll-driven dolly-back-and-tilt-up
 *
 * The camera is the storytelling element on scroll. Strings sit still
 * on the ground; the camera flies up and back, opening the perspective.
 * No EffectComposer — see history. Tonemapping is ACES.
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
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          outputColorSpace: THREE.SRGBColorSpace,
        }}
        onCreated={({ gl }) => {
          gl.toneMappingExposure = 0.82;
        }}
        camera={{
          // Initial pose matches CameraRig's top-of-page pose so first
          // paint isn't off — the rig takes over on frame 1 anyway.
          position: [0, 0.4, 1.2],
          fov: 55,
          near: 0.1,
          far: 60,
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ background: "#000000" }}
      >
        <ambientLight intensity={0.5} color="#7a808a" />
        <Atmosphere />
        <Strings />
        <CameraRig />
      </Canvas>
    </div>
  );
}
