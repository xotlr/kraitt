"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

/**
 * Atmosphere — a very dim warm noise field that sits behind the vines.
 * Plain shader material on a fullscreen plane drawn at z = -2. Much
 * subtler than the previous Instrument so the vines stay the focal point.
 */

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform vec2 uResolution;

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
  // Two-octave FBM. Three octaves looked nicer but cost 50% more per
  // fragment; the difference is invisible once we threshold the field
  // to only show the brightest pockets.
  float fbm(vec3 p) {
    float v = 0.0; float a = 0.6; vec3 shift = vec3(100.0);
    for (int i = 0; i < 2; i++) { v += a * snoise(p); p = p * 1.9 + shift; a *= 0.5; }
    return v;
  }
  void main() {
    vec2 uv = vUv;
    // Single FBM call (was 3 averaged + a second FBM = 9 octave calls
    // per pixel). The averaging "blur" was free-looking but expensive;
    // dropping it costs us a hair of softness that the film grain
    // covers anyway.
    float n = fbm(vec3(uv * 0.9, uTime * 0.04));
    float b = n * 0.5 + 0.5;

    // OLED-black bed. The warm pocket only appears in the brightest 5%
    // of the field — everywhere else this resolves to pure 0,0,0. The
    // pocket itself is barely-saturated taupe, so when it does appear
    // it reads as a slight breath, not a brown wash.
    vec3 bg = vec3(0.0);
    vec3 warm = vec3(0.022, 0.016, 0.010);
    vec3 col = mix(bg, warm, smoothstep(0.9, 1.0, b));

    // Vignette pulls edges to true 0. Multiplying by zero stays zero.
    float v = 1.0 - pow(abs(uv.y - 0.5) * 1.9, 2.0);
    col *= mix(0.0, 1.0, v);
    float vx = 1.0 - pow(abs(uv.x - 0.5) * 1.6, 2.0);
    col *= mix(0.0, 1.0, vx);

    // Animated film grain. One grain cell per ~2 screen pixels;
    // fract(time*100) re-rolls every frame so it twinkles. With a
    // pure-black bed, grain is most of what the user perceives in the
    // dark areas — it's the only texture in the field outside the
    // pockets.
    float grainSize = 2.0;
    vec2 gridPos = uv * uResolution / grainSize + fract(uTime * 100.0);
    float grain = (hash(gridPos) - 0.5) * 0.045;
    col += grain;

    // Clamp negative grain so we don't fight OLED-black with sub-zero
    // values (which would still display as 0 anyway, but this keeps
    // the math honest).
    col = max(col, vec3(0.0));

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function Atmosphere() {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
    }),
    []
  );
  useFrame(({ clock, size }) => {
    if (!matRef.current) return;
    matRef.current.uniforms.uTime.value = clock.elapsedTime;
    (matRef.current.uniforms.uResolution.value as THREE.Vector2).set(
      size.width,
      size.height
    );
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
