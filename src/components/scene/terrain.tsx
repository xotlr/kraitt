"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioLevels } from "@/lib/audio";
import { useScrollViewport } from "@/lib/scroll-context";

/**
 * Terrain — a real 3D plane laid flat on the ground, displaced by FBM
 * noise into a topographic landscape. The fragment shader draws gold
 * contour lines at fixed world-y intervals; because the surface is
 * actually 3D, contour density varies naturally with slope (lines
 * crowd on steep peaks, spread on flats).
 *
 * Scroll: the noise sample's z is offset by the page scroll position,
 * so as the user scrolls down, new terrain appears to flow past the
 * (fixed) camera. The camera itself doesn't move — terrain flows
 * underneath it.
 *
 * Audio reactivity:
 *   - bass: amplifies displacement (peaks rise) + tightens contour
 *     spacing (lines crowd globally during musical hits)
 *   - mid:  speeds noise drift
 *   - high: sharpens contour line edges
 *
 * Contour math: standard fract/derivative trick. Lines are pixel-stable
 * because we divide by fwidth(worldY), so they read crisp at any slope
 * or camera distance.
 *
 * References:
 *   - The Book of Shaders, "Truchet / Contour" patterns
 *   - Inigo Quilez, "Filtering a contour"
 */

const PLANE_SIZE = 30;          // world-units wide and deep
const SEGMENTS = 220;            // subdivision count — high enough that
                                 // the noise displacement looks smooth

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;         // 0..N, increments as user scrolls
  uniform float uBass;
  uniform float uMid;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vCameraDist;
  varying float vHeightNorm;     // 0..1 normalized height for surface shading

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
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.55;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(vec3(p, 0.0));
      p = p * 1.9 + vec2(31.4, 17.7);
      a *= 0.5;
    }
    return v;
  }

  void main() {
    // Sample noise in world XZ. Two independent drifts:
    //  - uScroll moves the field forward (along plane-local y / world z)
    //    so scrolling reveals new terrain.
    //  - uTime drifts the field SIDEWAYS (along plane-local x / world x)
    //    so the terrain visibly crawls even at rest. Decoupling these
    //    means scroll and time-motion don't alias each other.
    // The time multiplier is much larger than before (0.4 vs 0.05) so
    // the motion is genuinely visible — previous value was practically
    // frozen.
    // Three independent drifts. Multipliers bumped substantially so
    // the motion is genuinely visible to the eye rather than measurable
    // only via pixel diffs.
    vec2 sampleP = vec2(
      position.x + uTime * 2.5,
      position.y + uScroll + uTime * 1.0
    );

    float warp = fbm(sampleP * 0.3) * 0.5;
    float h = fbm(sampleP * 0.5 + warp);

    // Built-in "wave" — fast sine pulse independent of audio so peaks
    // visibly heave regardless of music state.
    float idlePulse = sin(uTime * 1.4) * 0.5 + 0.5; // 0..1

    // Amplitude. Audio response bumped from 2.5x -> 4.5x — bass peaks
    // now visibly LIFT the terrain rather than nudging it. Combined
    // with the contour spacing tightening below, peaks read as both
    // taller and more compressed during musical hits.
    float amp = 1.2 * (1.0 + uBass * 4.5 + idlePulse * 0.2);
    float displaced = h * amp;

    vec3 newPos = vec3(position.x, position.y, displaced);

    // Compute world position for the fragment shader's contour math.
    vec4 worldPos = modelMatrix * vec4(newPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldY = worldPos.y;
    // Normalize height to 0..1 for surface shading. h was in roughly
    // -1..+1 range from fbm; remap to 0..1 so peaks=1, valleys=0.
    vHeightNorm = clamp(h * 0.5 + 0.5, 0.0, 1.0);

    // Camera distance for atmospheric depth fade.
    vCameraDist = length(cameraPosition - worldPos.xyz);

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vCameraDist;
  varying float vHeightNorm;
  uniform float uBass;
  uniform float uHigh;
  uniform vec3 uColor;

  void main() {
    // Contour spacing. Bass tightens spacing dramatically — lines
    // visibly crowd into denser bands on beats. The clamp prevents
    // spacing from collapsing below 30% of the base so peaks don't
    // become a solid wash.
    float baseSpacing = 0.04;
    float spacing = baseSpacing * (1.0 - clamp(uBass * 1.4, 0.0, 0.55));

    // Standard contour math.
    float ratio = vWorldY / spacing;
    float distNorm = abs(fract(ratio) - 0.5);

    // Atmospheric depth fade — tightened so far lines genuinely
    // disappear into the OLED black rather than lingering as faint
    // ghosts. smoothstep edges chosen so the visible terrain zone
    // is 3.5..11 wu from camera; past that, full fade to invisible.
    float depthFade = smoothstep(11.0, 3.5, vCameraDist);

    // Pixel-stable line width via screen-space derivatives. Near lines
    // crisp, far lines softer.
    float widthScale = mix(0.95, 0.45, depthFade);
    float w = fwidth(ratio) * widthScale;
    w *= 1.0 - uHigh * 0.3;
    float line = 1.0 - smoothstep(w * 0.5, w, distNorm);

    // Per-line opacity jitter — each contour level gets a brightness
    // factor so density visibly varies.
    float lineId = floor(ratio);
    float lineJitter = 0.55 + 0.45 * fract(sin(lineId * 12.9898) * 43758.5453);
    line *= lineJitter;
    line *= depthFade;

    // Right-side mask so the type column on the left stays clean.
    float rightMask = smoothstep(-2.5, 2.5, vWorldPos.x);
    line *= rightMask;

    // ---- SURFACE FILL ----
    // The mesh between contour lines also draws now — a faint
    // height-based gradient that gives the terrain a "3D mesh gradient"
    // look. Peaks slightly brighter than valleys, far slopes fade to
    // black via depthFade. This is what makes the 3D form readable
    // instead of just floating contour outlines on void.
    float surfaceShade = vHeightNorm * 0.18 + 0.02;  // 0.02 in valleys, 0.20 at peaks
    surfaceShade *= depthFade;
    surfaceShade *= rightMask;
    // Genuinely cool surface tone (B > G > R).
    vec3 surfaceColor = vec3(0.14, 0.17, 0.23) * surfaceShade;

    // ---- LINE COLOR ----
    // Genuinely cold white-blue by default. The previous "cool cream"
    // #e6dfd1 was actually slightly warm-cream (R>G>B) which on OLED
    // black reads gold-adjacent. #dde2ea has B>G>R — actually cool.
    // Gold tint only kicks in past 0.5 bass and is mostly gold by 0.8
    // — only the loudest beats trigger the warm color.
    vec3 cool = vec3(0.867, 0.886, 0.918);   // #dde2ea genuinely cold
    vec3 gold = vec3(0.722, 0.518, 0.361);   // #b8845c
    float goldMix = smoothstep(0.5, 0.8, uBass);
    vec3 lineColor = mix(cool, gold, goldMix);

    // Composite: surface fill + lines on top. Don't discard — the
    // surface fill makes the mesh visible even between lines.
    vec3 finalColor = surfaceColor + lineColor * line;
    float finalAlpha = max(surfaceShade, line);

    if (finalAlpha < 0.005) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const levels = useAudioLevels();
  const viewportRef = useScrollViewport();

  const { geometry, uniforms } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      SEGMENTS,
      SEGMENTS
    );
    const u = {
      uTime: { value: 0 },
      uScroll: { value: 0 },
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uColor: { value: new THREE.Color("#b8845c") },
    };
    return { geometry: geo, uniforms: u };
  }, []);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  const scrollTarget = useRef(0);
  const scrollSmoothed = useRef(0);

  // Read scroll position from the ScrollArea viewport, not window.
  // Same source the rest of the scroll-driven code uses.
  useEffect(() => {
    const updateScroll = () => {
      const el = viewportRef.current;
      if (!el) return;
      // Map raw scrollTop to terrain z-offset. Tuning: 1000px of scroll
      // = 8 world units of terrain travel. Tweak as you scroll the
      // page and decide how fast new terrain should reveal.
      scrollTarget.current = el.scrollTop * 0.008;
    };
    const id = requestAnimationFrame(() => {
      updateScroll();
      const el = viewportRef.current;
      if (el) el.addEventListener("scroll", updateScroll, { passive: true });
    });
    return () => {
      cancelAnimationFrame(id);
      const el = viewportRef.current;
      if (el) el.removeEventListener("scroll", updateScroll);
    };
  }, [viewportRef]);

  useFrame(({ clock }) => {
    // Smooth scroll target → actual scroll uniform with a low-pass so
    // the terrain doesn't jitter on scroll.
    scrollSmoothed.current +=
      (scrollTarget.current - scrollSmoothed.current) * 0.1;
    uniforms.uTime.value = clock.elapsedTime;
    uniforms.uScroll.value = scrollSmoothed.current;
    uniforms.uBass.value = levels.current.bass;
    uniforms.uMid.value = levels.current.mid;
    uniforms.uHigh.value = levels.current.high;
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      // PlaneGeometry is XY-aligned by default; rotate -90° around X
      // so it lies flat on the XZ ground plane with local-Y pointing
      // forward (into the scene). The vertex shader writes Z, which
      // after this rotation becomes world-up.
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      frustumCulled={false}
    >
      <shaderMaterial
        ref={matRef}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
