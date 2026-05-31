"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioLevels } from "@/lib/audio";
import { useTheme } from "@/lib/theme-context";
import { assertUniformsUsed } from "./assert-uniforms";
import { SIMPLEX_3D } from "./glsl-noise";

/**
 * Atmosphere — the entire visual: OLED-black bed, film grain, and the
 * wavy "string" lines. Lines are drawn as iso-contours of a
 * domain-warped FBM noise field. Domain warping is the operation that
 * turns concentric noise blobs into long flowing strands — sampling
 * `fbm(uv + fbm(uv))` instead of `fbm(uv)` warps the input space, and
 * the resulting iso-contours bend into organic curves rather than
 * sitting as round blobs.
 *
 * Why this technique instead of geometry ribbons: sine displacement of
 * line/ribbon vertices can't produce continuously flowing curves — it
 * produces parallel sinusoidal lines, period. Iso-contours of warped
 * noise are topologically the right primitive for "wavy strings."
 *
 * References:
 *  - Inigo Quilez, "Domain warping" — the foundational article.
 *  - Codrops "Dissecting a Wavy Shader" (Oct 2025).
 *  - ShaderToy sstXW8 minimal wavy lines example.
 *
 * Audio reactivity:
 *  - uBass:  line brightness, color tint toward warm amber
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    // Fullscreen quad — bypass camera entirely.
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uBass;
  uniform float uTheme;       // 0 = dark (OLED), 1 = light (warm paper)
  // --- simplex 3D noise (Ashima) ---
  ${SIMPLEX_3D}

  // 2-octave FBM. Cheap; the visual interest comes from domain warping
  // the result, not from stacking many octaves.
  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.6;
    vec3 shift = vec3(100.0);
    for (int i = 0; i < 2; i++) {
      v += a * snoise(p);
      p = p * 1.9 + shift;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec2 uv = vUv;
    vec2 p = uv;
    p.x *= uResolution.x / uResolution.y;

    // Bed + sparse pockets. Dark mode: OLED black with faint warm
    // pockets. Light mode: warm paper (#f5f2ec ≈ 0.96,0.95,0.925) with
    // faint warm-darker pockets, so the field reads on white.
    float t = uTime * 0.04;
    float n = fbm(vec3(p * 1.4, t));
    vec3 bgDark = vec3(0.0);
    vec3 bgLight = vec3(0.949, 0.945, 0.937);      // near-neutral paper grey
    vec3 bg = mix(bgDark, bgLight, uTheme);
    vec3 pocketDark = vec3(0.016, 0.015, 0.013);   // faint neutral lift
    vec3 pocketLight = vec3(0.885, 0.875, 0.860);  // dip toward neutral grey
    vec3 pocketColor = mix(pocketDark, pocketLight, uTheme);
    float pocket = smoothstep(0.94, 1.0, n * 0.5 + 0.5);
    float pocketBoost = 1.0 + uBass * 0.6;
    vec3 col = mix(bg, pocketColor * pocketBoost, pocket);

    // ---- GROUND-FOG HAZE BAND (§5) ----
    // The terrain emerges from a defined horizon; give it something to sit
    // IN by lifting the lower third of the bed by a hair of cold near-
    // black. vUv.y is 0 at the bottom; the band ramps in below ~0.45 and
    // is strongest at the very bottom. Kept tiny — a few thousandths — so the
    // bed still reads as OLED black, just no longer a dead flat void. The
    // FBM noise (n) breaks the band up so it drifts like real haze rather
    // than a clean gradient. Dark mode only; paper needs no fog.
    float fogBand = smoothstep(0.45, 0.0, vUv.y);          // 0 above mid, 1 at floor
    float fogBreakup = 0.7 + 0.3 * (n * 0.5 + 0.5);        // soft noise modulation
    vec3 groundFog = vec3(0.018, 0.022, 0.030);            // cold near-black lift
    col += groundFog * fogBand * fogBreakup * (1.0 - uTheme);

    // Film grain is NOT applied here anymore. It used to live in this shader,
    // but that only grained the scene INSIDE the island. It now lives in a
    // single page-wide GPU overlay (components/grain-overlay.tsx) that grains
    // the scene, the console chrome, and the editorial type together as one
    // unified film layer, rendered at full device resolution. Keeping it out
    // of here avoids double-graining the scene area.
    col = max(col, vec3(0.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Atmosphere() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const levels = useAudioLevels();
  const { theme } = useTheme();
  const themeMix = useRef(0);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uBass: { value: 0 },
      uTheme: { value: 0 },
    }),
    []
  );

  // Dispose the ShaderMaterial on unmount (r3f auto-disposes the JSX
  // planeGeometry, but not the material built from the tag).
  useEffect(() => () => matRef.current?.dispose(), []);

  // Dev guard: warn on any uniform declared but never read by a shader stage.
  useEffect(() => {
    assertUniformsUsed("atmosphere", uniforms, vertexShader, fragmentShader);
  }, [uniforms]);

  useFrame(({ clock, size }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTime.value = clock.elapsedTime;
    (u.uResolution.value as THREE.Vector2).set(size.width, size.height);
    u.uBass.value = levels.current.bass;
    // Ease theme mix (≈450ms at 60fps) so the bed morphs with the page.
    const target = theme === "light" ? 1 : 0;
    themeMix.current += (target - themeMix.current) * 0.08;
    u.uTheme.value = themeMix.current;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
