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
const SEGMENTS = 160;            // 160x160 ≈ 25k tris. Was 220 (97k);
                                 // perf audit flagged FBM-per-vertex
                                 // as the scene's main cost. At 160
                                 // the displacement still reads smooth
                                 // and we get ~50% less vertex work.

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uScroll;
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform vec2 uMouse;        // plane-local XY of cursor
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vCameraDist;
  varying float vHeightNorm;

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
  // FBM that takes time as the z-axis of 3D simplex noise — this is
  // what makes the terrain genuinely EVOLVE in place rather than
  // translate. Each octave advances at a faster time rate (small
  // detail boils faster, large structure drifts slower), matching the
  // standard "shifting dunes" technique (IQ Elevated, ShaderToy
  // Xll3RM, Marching Desert).
  float fbm(vec2 p, float t) {
    float v = 0.0;
    float a = 0.55;
    float tz = t;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(vec3(p, tz));
      p = p * 1.9 + vec2(31.4, 17.7);
      a *= 0.5;
      tz *= 1.6;  // higher octaves animate faster
    }
    return v;
  }

  void main() {
    // ---- AUDIO OCEAN ----
    // The surface is water, not terrain. Six layered traveling sine
    // waves at different frequencies, directions, and speeds — a
    // simplified Gerstner-style ocean. Each wave moves continuously
    // across the surface; together they create the irregular swell
    // of a real sea. Audio bands drive amplitude per layer.
    //
    // Wave i: amplitude * sin(dot(direction, position) * freq + time * speed + phase)
    //
    // Wave 1: big slow primary swell — the dominant ocean rhythm.
    //         Bass amplifies it dramatically (a 0.5 bass peak nearly
    //         doubles the swell height).
    // Wave 2: secondary swell, perpendicular direction, slower.
    // Wave 3-4: medium chop, faster, smaller. Mid frequencies drive.
    // Wave 5-6: high-frequency surface ripple. Highs drive.
    // Idle = calm sea, audio = real waves. Amplitudes reduced ~40%
    // from previous tuning so the surface stays smooth/inviting,
    // peaks don't heave dramatically. Lower-frequency components
    // dominate so the result reads as broad ocean swell, not chop.
    float bassEase = pow(uBass, 1.5);
    float midEase = pow(uMid, 1.5);
    float highEase = pow(uHigh, 1.4);

    // All wave time multipliers halved — the previous speed felt
    // hectic. Slow ocean now: big swells over ~15 seconds, chop
    // ~6-8 seconds, ripples ~3-4 seconds.
    float bigSwell =
      sin(dot(vec2(1.0, 0.2), position.xy) * 0.28 + uTime * 0.4) *
      (0.14 + bassEase * 1.3);
    float crossSwell =
      sin(dot(vec2(0.3, 1.0), position.xy) * 0.34 + uTime * 0.28 + 1.7) *
      (0.10 + bassEase * 0.85);
    float chop1 =
      sin(dot(vec2(0.7, -0.7), position.xy) * 0.9 + uTime * 0.7 + 0.5) *
      (0.05 + midEase * 0.9);
    float chop2 =
      sin(dot(vec2(-0.5, 0.85), position.xy) * 1.05 + uTime * 0.85 + 3.0) *
      (0.04 + midEase * 0.7);
    float ripple1 =
      sin(dot(vec2(0.9, 0.4), position.xy) * 2.2 + uTime * 1.45) *
      (0.025 + highEase * 0.35);
    float ripple2 =
      sin(dot(vec2(-0.6, 0.8), position.xy) * 2.8 + uTime * 1.65 + 2.2) *
      (0.02 + highEase * 0.25);

    // Sum the wave layers.
    float waveSum =
      bigSwell * 0.85 +
      crossSwell * 0.55 +
      chop1 * 0.18 +
      chop2 * 0.14 +
      ripple1 +
      ripple2;

    // Water texture — soft broad FBM noise on top of the sines.
    float texture = fbm(position.xy * 0.35, uTime * 0.22) * 0.06;

    // Mouse-driven ripple: a smooth bump centered at the cursor's
    // plane-local position. Gaussian falloff so the disturbance is
    // soft at the edges. The vertex rises slightly under the cursor
    // and tapers to zero past ~2 wu radius. Amplitude tied to a
    // small fixed value — strong enough to feel responsive but not
    // dominating the wave field.
    float mouseDist = distance(position.xy, uMouse);
    float mouseBump = exp(-mouseDist * mouseDist * 0.6) * 0.35;

    float displaced = waveSum + texture + mouseBump;

    vec3 newPos = vec3(position.x, position.y, displaced);

    // Compute world position for the fragment shader's contour math.
    vec4 worldPos = modelMatrix * vec4(newPos, 1.0);
    vWorldPos = worldPos.xyz;
    vWorldY = worldPos.y;
    // Normalize wave height to 0..1 for surface shading. The summed
    // wave displacement is roughly -2..+2 wu; remap to 0..1 so wave
    // crests=1, troughs=0.
    vHeightNorm = clamp(displaced * 0.25 + 0.5, 0.0, 1.0);

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

    // Atmospheric depth fade. Visible band is 3.0..9.0 wu — tighter
    // than before so the FAR distance fully dissolves into OLED
    // black, and the near foreground reads as brighter. Deepens the
    // overall sense of atmospheric perspective.
    float depthFade = smoothstep(9.0, 3.0, vCameraDist);

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

    // Right-side mask, softened. Previously cut lines to 0 on the far
    // left; the hero now sits IN FRONT of faint waves rather than
    // beside them, so lines bleed leftward at ~25% opacity. Far right
    // is still full strength; far left floors at 0.25 so the wordmark
    // reads against a faint continuation of the wave field, not a
    // hard cutoff. Surface fill still uses the same mask, so the
    // mesh shading dims in lockstep.
    float rightMask = mix(0.25, 1.0, smoothstep(-2.5, 2.5, vWorldPos.x));
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
      // Mouse position in plane-local XY. (-99, -99) = off-surface
      // (no ripple) at startup so the cursor effect only kicks in
      // once the user actually moves the mouse over the canvas.
      uMouse: { value: new THREE.Vector2(-99, -99) },
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

  // Mouse in NDC, raycast into plane-local space each frame. Target
  // and smoothed are kept separately so the ripple eases in/out of
  // motion instead of snapping with the cursor.
  const mouseNDC = useRef(new THREE.Vector2(-99, -99));
  const mouseLocalTarget = useRef(new THREE.Vector2(-99, -99));
  const mouseLocalSmoothed = useRef(new THREE.Vector2(-99, -99));
  const camera = useThree((s) => s.camera);
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const intersectScratch = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      mouseNDC.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNDC.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onLeave = () => {
      // Off-canvas → push the target way off-surface so the ripple
      // dies smoothly via the lerp below.
      mouseLocalTarget.current.set(-99, -99);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerleave", onLeave);
    };
  }, []);

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
    scrollSmoothed.current +=
      (scrollTarget.current - scrollSmoothed.current) * 0.1;

    const mat = matRef.current;
    const mesh = meshRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uScroll.value = scrollSmoothed.current;
    u.uBass.value = levels.current.bass;
    u.uMid.value = levels.current.mid;
    u.uHigh.value = levels.current.high;

    // ---- MOUSE RIPPLE ----
    // Raycast from camera through cursor NDC onto the plane. The hit
    // point's plane-LOCAL XY (NOT world XY) is what the vertex shader
    // expects since vertex positions are pre-rotation. We convert by
    // applying the inverse of the mesh's world matrix.
    if (mesh && mouseNDC.current.x > -2) {
      raycaster.setFromCamera(mouseNDC.current, camera);
      const hit = raycaster.intersectObject(mesh, false)[0];
      if (hit) {
        // hit.point is world space. Convert to plane-local by
        // inverse-transforming through the mesh's matrix.
        intersectScratch.copy(hit.point);
        mesh.worldToLocal(intersectScratch);
        mouseLocalTarget.current.set(intersectScratch.x, intersectScratch.y);
      }
    }
    // Smooth toward target so the ripple eases in/out instead of
    // snapping. Faster lerp = snappier cursor feel.
    mouseLocalSmoothed.current.x +=
      (mouseLocalTarget.current.x - mouseLocalSmoothed.current.x) * 0.12;
    mouseLocalSmoothed.current.y +=
      (mouseLocalTarget.current.y - mouseLocalSmoothed.current.y) * 0.12;
    (u.uMouse.value as THREE.Vector2).copy(mouseLocalSmoothed.current);
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
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
