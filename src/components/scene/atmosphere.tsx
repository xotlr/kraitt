"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioLevels } from "@/lib/audio";

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
 *  - uMid:   warp drift speed (faster flow on energetic passages)
 *  - uHigh:  line width (sharper / more nervous on transient hits)
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
  uniform float uMid;
  uniform float uHigh;

  // --- hash + simplex 3D noise (Ashima) ---
  float hash(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

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

    // OLED black bed + sparse warm pockets.
    float t = uTime * 0.04;
    float n = fbm(vec3(p * 1.4, t));
    vec3 bg = vec3(0.0);
    vec3 pocketColor = vec3(0.020, 0.014, 0.008);
    float pocket = smoothstep(0.94, 1.0, n * 0.5 + 0.5);
    float pocketBoost = 1.0 + uBass * 0.6;
    vec3 col = mix(bg, pocketColor * pocketBoost, pocket);

    // Film grain — 2Hz re-roll, low amplitude. Subtle texture rather
    // than visible flicker.
    float grainSize = 2.0;
    vec2 gridPos = uv * uResolution / grainSize + fract(uTime * 2.0);
    float grain = (hash(gridPos) - 0.5) * 0.022;
    col += grain;

    col = max(col, vec3(0.0));
    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Atmosphere() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const levels = useAudioLevels();

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
    }),
    []
  );

  useFrame(({ clock, size }) => {
    if (!matRef.current) return;
    const u = matRef.current.uniforms;
    u.uTime.value = clock.elapsedTime;
    (u.uResolution.value as THREE.Vector2).set(size.width, size.height);
    u.uBass.value = levels.current.bass;
    u.uMid.value = levels.current.mid;
    u.uHigh.value = levels.current.high;
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
