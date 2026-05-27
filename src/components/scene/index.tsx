"use client";

import { Canvas } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { useDeviceCapability } from "@/hooks/use-device-capability";
import { Atmosphere } from "./atmosphere";
import { Strings } from "./strings";

/**
 * Scene composition:
 *   1. OLED-black atmosphere with rare sparse warm pockets + film grain
 *   2. thin grey Line2 strings drifting in the background
 *
 * No EffectComposer. With a pure-black bed and strings authored at
 * desaturated greys, post-processing (bloom, hue-sat) was paying its
 * full per-frame cost for no visible output — the bloom threshold
 * never tripped and the saturation cut had nothing to desaturate.
 * Ripping it removes a full-screen mipmap chain per frame.
 *
 * Tonemapping is ACES filmic with low exposure so any warmth in the
 * sparse pockets stays compressed.
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
          position: [0, 0, 2.4],
          fov: 45,
          near: 0.1,
          far: 50,
        }}
        frameloop={reducedMotion ? "demand" : "always"}
        style={{ background: "#000000" }}
      >
        <ambientLight intensity={0.5} color="#7a808a" />
        <Atmosphere />
        <Strings />
      </Canvas>
    </div>
  );
}
