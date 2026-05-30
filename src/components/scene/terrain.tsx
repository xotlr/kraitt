"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioLevels } from "@/lib/audio";
import { useScrollViewport } from "@/lib/scroll-context";
import { useTheme } from "@/lib/theme-context";

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
  uniform float uPulse;       // 0->1 radial pulse envelope (beat hits + manual plucks)
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
    // Gentle gamma. The old 1.5 curve crushed mid-level beats (a 0.5
    // hit became 0.35 before the field floor halved it again), so the
    // surface barely rose. 1.1 keeps a little toe to suppress noise but
    // lets real beats through close to 1:1.
    float bassEase = pow(uBass, 1.1);
    float midEase = pow(uMid, 1.1);
    float highEase = pow(uHigh, 1.1);

    // ---- SPATIAL AUDIO ENERGY ----
    // The old version multiplied every wave by a single global band
    // value, so the whole plane heaved in unison — a uniform pump, not
    // a sea. Here each band's energy TRAVELS across the surface as a
    // moving field, so a hit reads as a wavefront sweeping through the
    // water rather than the entire surface lifting at once.
    //
    // Each "audioField" is a slow large-scale ripple in *amplitude*
    // (not height) that drifts in its own direction. Where the field is
    // high, that band's waves are tall; where it's low, they're flat.
    // The field itself moves, so the tall region moves — energy with a
    // location and a velocity. Different directions per band keep them
    // from peaking together.
    float bassField = 0.5 + 0.5 * sin(dot(vec2(0.9, 0.35), position.xy) * 0.22 - uTime * 0.30);
    float midField  = 0.5 + 0.5 * sin(dot(vec2(-0.4, 0.95), position.xy) * 0.40 + uTime * 0.55);
    float highField = 0.5 + 0.5 * sin(dot(vec2(0.6, -0.8), position.xy) * 0.70 + uTime * 0.95 + 1.3);

    // Band energy = global level shaped by its traveling field. The
    // field MODULATES the energy spatially but no longer starves it: the
    // floor is high (0.7) so a beat lifts the whole surface, while the
    // field still adds ~40% extra height where it peaks — that's the
    // travelling wavefront. Previously the floor was 0.45/0.35, which
    // combined with the gamma meant beats barely registered.
    float audioBass = bassEase * (0.7 + 0.4 * bassField);
    float audioMid  = midEase  * (0.7 + 0.4 * midField);
    float audioHigh = highEase * (0.7 + 0.4 * highField);

    // Wave time multipliers reduced a further ~40% (was already halved
    // once). Even slower ocean now: big swells over ~25 seconds, chop
    // ~10-13 seconds, ripples ~5-7 seconds.
    float bigSwell =
      sin(dot(vec2(1.0, 0.2), position.xy) * 0.28 + uTime * 0.24) *
      (0.14 + audioBass * 1.3);
    float crossSwell =
      sin(dot(vec2(0.3, 1.0), position.xy) * 0.34 + uTime * 0.17 + 1.7) *
      (0.10 + audioBass * 0.85);
    float chop1 =
      sin(dot(vec2(0.7, -0.7), position.xy) * 0.9 + uTime * 0.42 + 0.5) *
      (0.05 + audioMid * 0.9);
    float chop2 =
      sin(dot(vec2(-0.5, 0.85), position.xy) * 1.05 + uTime * 0.51 + 3.0) *
      (0.04 + audioMid * 0.7);
    float ripple1 =
      sin(dot(vec2(0.9, 0.4), position.xy) * 2.2 + uTime * 0.87) *
      (0.025 + audioHigh * 0.35);
    float ripple2 =
      sin(dot(vec2(-0.6, 0.8), position.xy) * 2.8 + uTime * 0.99 + 2.2) *
      (0.02 + audioHigh * 0.25);

    // ---- RADIAL BEAT PULSE ----
    // On a bass hit, a ring expands outward from the origin (the sound
    // "source"). uPulse is a 0->1 envelope retriggered on each beat in
    // JS; here it drives a sine ring whose radius grows as the envelope
    // decays, so the crest sweeps outward and fades. This is the most
    // literal "spatial wave" — a disturbance with an epicenter that
    // propagates. Damped by distance so it dies out toward the horizon.
    float radius = length(position.xy);
    float ringPhase = radius * 1.1 - uPulse * 9.0;       // crest travels out as pulse rises
    float ringEnv = uPulse * (1.0 - uPulse);             // 0 at rest & full, peaks mid-pulse
    float radialPulse =
      sin(ringPhase) *
      exp(-radius * 0.18) *                              // distance damping
      ringEnv * 1.6;

    // Sum the wave layers.
    float waveSum =
      bigSwell * 0.85 +
      crossSwell * 0.55 +
      chop1 * 0.18 +
      chop2 * 0.14 +
      ripple1 +
      ripple2 +
      radialPulse;

    // Water texture — soft broad FBM noise on top of the sines.
    float texture = fbm(position.xy * 0.35, uTime * 0.13) * 0.06;

    float displaced = waveSum + texture;

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
  uniform float uTheme;   // 0 = dark, 1 = light (eased in JS)

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

    // Atmospheric depth fade. Visible band widened to 2.5..12.0 wu so
    // more of the plane reads as live signal (the old 3..9 band dissolved
    // most of the terrain into black, leaving only a few corner contours).
    // The far edge still fades fully to OLED black for atmospheric depth.
    float depthFade = smoothstep(12.0, 2.5, vCameraDist);

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
    float surfaceShade = vHeightNorm * 0.26 + 0.03;  // 0.03 in valleys, 0.29 at peaks
    surfaceShade *= depthFade;
    surfaceShade *= rightMask;
    // Surface fill between the lines. Dark mode: a faint cool tint that
    // makes the 3D form readable on black. Light mode: we DROP this almost
    // entirely so clean paper shows between the lines — a grey fill there
    // just washes the contrast out and buries the lines. Fade it to ~0 as
    // uTheme→1.
    vec3 surfaceTint = vec3(0.14, 0.17, 0.23);   // the fill COLOUR (not premult)
    float surfaceAlpha = surfaceShade * (1.0 - uTheme * 0.92);

    // ---- LINE COLOR ----
    // Dark mode: cold white-blue, warming to gold only on loud beats.
    // Light mode: a warm near-black ink so the contours read as drawn
    // lines on paper; gold beat-tint still applies.
    vec3 cool = vec3(0.867, 0.886, 0.918);   // #dde2ea genuinely cold
    vec3 gold = vec3(0.722, 0.518, 0.361);   // #b8845c
    vec3 inkLine = vec3(0.08, 0.06, 0.04);   // near-black warm ink for light
    float goldMix = smoothstep(0.5, 0.8, uBass);
    vec3 darkLine = mix(cool, gold, goldMix);
    vec3 lightLine = mix(inkLine, gold, goldMix * 0.7);
    vec3 lineColor = mix(darkLine, lightLine, uTheme);

    // Line alpha. Dark mode lifted to 1.35× so the contours are clearly
    // the brightest thing on the OLED-black bed (the instrument reads as a
    // live signal, not faint corner lines). Light mode stays ~2.8× so the
    // field reads as drawn ink on paper rather than washing out.
    float lineAlpha = line * mix(1.35, 2.8, uTheme);

    // Composite as proper (non-premultiplied) source colour + coverage.
    // The fragment alpha-blends over the atmosphere's background, so the
    // RGB we output must be the un-weighted colour (the blender applies
    // src.a). Lines sit over the surface fill: pick the line colour where
    // it covers, else the surface tint. This matters on the light paper
    // bed where the destination is bright (the old additive form only
    // looked right because dark-mode dst was black).
    float finalAlpha = max(surfaceAlpha, lineAlpha);
    float lineFrac = finalAlpha > 0.0001 ? lineAlpha / finalAlpha : 0.0;
    // Both surfaceTint and lineColor are plain (un-premultiplied) colours;
    // pick line where it covers, surface tint elsewhere.
    vec3 finalColor = mix(surfaceTint, lineColor, lineFrac);

    if (finalAlpha < 0.005) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const levels = useAudioLevels();
  const viewportRef = useScrollViewport();
  const { theme } = useTheme();
  // Eased 0..1 theme mix the shader reads; lerps toward the target so the
  // background morphs in sync with the CSS @property token transition
  // rather than snapping (the moneypower pattern).
  const themeMix = useRef(0);

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
      uPulse: { value: 0 },
      uTheme: { value: 0 },
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

  // Radial beat pulse state. We detect a bass ONSET (this frame's bass
  // jumped well above last frame's) and, when not already mid-pulse,
  // launch a 0->1 ramp. The ramp drives uPulse, which the shader turns
  // into an expanding ring. prevBass tracks the previous frame's level
  // for onset detection; pulse is the live envelope value.
  const prevBass = useRef(0);
  const pulse = useRef(0);
  const pulseActive = useRef(false);

  // Eased band amplitudes for the WAVE FIELD and contours. The shared
  // audio levels have a deliberately snappy attack (good for the beat
  // glow and the radial-pulse onset, which want the raw transient), but
  // feeding them straight into wave height made the surface surge and
  // collapse in a single frame. These refs are a slower one-pole over
  // those levels — separate attack vs. release so energy swells in over
  // a few frames and ebbs out gently, like real water gaining/losing a
  // swell rather than snapping to it. Used ONLY for the uniforms; the
  // onset detector below still reads the raw level.
  const ampBass = useRef(0);
  const ampMid = useRef(0);
  const ampHigh = useRef(0);

  // Last pulse counter we acted on. The console buttons increment
  // levels.current.pulse via triggerPulse(); when this lags that, fire a
  // manual ripple (see useFrame). Lets a click "pluck" the surface when
  // no audio is driving it.
  const seenPulse = useRef(0);

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
    if (!mat) return;
    const u = mat.uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uScroll.value = scrollSmoothed.current;

    // Ease theme mix toward target (0 dark / 1 light). 0.08/frame ≈ a
    // ~450ms settle at 60fps, matching the CSS token transition.
    const themeTarget = theme === "light" ? 1 : 0;
    themeMix.current += (themeTarget - themeMix.current) * 0.08;
    u.uTheme.value = themeMix.current;

    // Ease the band amplitudes toward the live levels. Asymmetric and
    // attack-heavy: the wave reacts fast on the way UP (so it tracks the
    // beat without feeling laggy) but releases slowly on the way DOWN,
    // so it swells with the hit and then ebbs out smoothly instead of
    // snapping to zero. Earlier values smoothed the attack too — that
    // read as lag. The fade was never the problem; only the surge was.
    const AMP_ATTACK = 0.4;
    const AMP_RELEASE = 0.05;
    const ease = (cur: number, target: number) =>
      cur + (target - cur) * (target > cur ? AMP_ATTACK : AMP_RELEASE);
    ampBass.current = ease(ampBass.current, levels.current.bass);
    ampMid.current = ease(ampMid.current, levels.current.mid);
    ampHigh.current = ease(ampHigh.current, levels.current.high);
    u.uBass.value = ampBass.current;
    u.uMid.value = ampMid.current;
    u.uHigh.value = ampHigh.current;

    // ---- RADIAL PULSE TRIGGER ----
    // Two ways to launch the expanding ring:
    //   1. A bass ONSET — bass surged this frame and is loud enough.
    //   2. A MANUAL pluck — a console button bumped levels.pulse while no
    //      audio is playing, so a click ripples the surface itself.
    // Either fires only when no ring is already in flight, so one
    // beat/click = one clean ring rather than a per-frame retrigger.
    const bassNow = levels.current.bass;
    const onset = bassNow - prevBass.current > 0.18 && bassNow > 0.35;
    const plucked = levels.current.pulse !== seenPulse.current;
    seenPulse.current = levels.current.pulse;
    if ((onset || plucked) && !pulseActive.current) {
      pulseActive.current = true;
      pulse.current = 0;
    }
    prevBass.current = bassNow;
    if (pulseActive.current) {
      // Advance the ring. ~1.4s to fully expand and fade, then disarm.
      pulse.current += 0.012;
      if (pulse.current >= 1) {
        pulse.current = 0;
        pulseActive.current = false;
      }
    }
    u.uPulse.value = pulse.current;
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
