"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useAudioLevels } from "@/lib/audio";
import { useTheme } from "@/lib/theme-context";
import { assertUniformsUsed } from "./assert-uniforms";
import { SIMPLEX_3D } from "./glsl-noise";

/**
 * Terrain — a real 3D plane laid flat on the ground, displaced by FBM
 * noise into a topographic landscape. The fragment shader draws gold
 * contour lines at fixed world-y intervals; because the surface is
 * actually 3D, contour density varies naturally with slope (lines
 * crowd on steep peaks, spread on flats).
 *
 * Scroll motion is supplied by the camera dolly in CameraRig, not here —
 * the terrain field evolves in place (FBM over a time axis) and the camera
 * travels across it as the page scrolls.
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
  uniform float uBass;
  uniform float uMid;
  uniform float uHigh;
  uniform float uPulse;       // 0->1 radial pulse envelope (beat hits + manual plucks)
  uniform vec2 uDir;          // auto-conductor heading (unit vec2 on the ground plane; §6)
  varying float vWorldY;
  varying vec3 vWorldPos;
  varying float vCameraDist;
  varying float vHeightNorm;
  varying vec3 vNormal;       // world-space surface normal (analytic, from the sine sum)

  ${SIMPLEX_3D}
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
    //
    // Each wave is sin(dot(D, position.xy) * F + uTime*S + phase) * Amp.
    // We compute the phase argument ONCE, take sin() for the height and
    // cos() for the analytic gradient (d/dx = cos(arg) * D.x * F * Amp).
    // The gradient sum gives the surface normal for the §3 sculpted
    // light — no dFdx/dFdy and no extra noise; just the six cosines we
    // already have the arguments for.
    vec2 dirBig = vec2(1.0, 0.2);   float frqBig = 0.28; float ampBig = (0.14 + audioBass * 1.3);
    vec2 dirCrs = vec2(0.3, 1.0);   float frqCrs = 0.34; float ampCrs = (0.10 + audioBass * 0.85);
    vec2 dirCh1 = vec2(0.7, -0.7);  float frqCh1 = 0.9;  float ampCh1 = (0.05 + audioMid * 0.9);
    vec2 dirCh2 = vec2(-0.5, 0.85); float frqCh2 = 1.05; float ampCh2 = (0.04 + audioMid * 0.7);
    vec2 dirRp1 = vec2(0.9, 0.4);   float frqRp1 = 2.2;  float ampRp1 = (0.025 + audioHigh * 0.35);
    vec2 dirRp2 = vec2(-0.6, 0.8);  float frqRp2 = 2.8;  float ampRp2 = (0.02 + audioHigh * 0.25);

    // ---- ANISOTROPIC LEAN (§7.2) ----
    // Bias each wave's spatial frequency toward the conductor heading: a
    // wave aligned with uDir keeps its frequency (so its crests pack tight
    // ALONG the heading), a wave across uDir is stretched (crests spread).
    // The field "leans" the way the baton points. Crucially we mix from
    // 1.0 (never below 1-leanAmount) so a wave perpendicular to uDir does
    // NOT collapse to a flat DC offset — that would pop the whole plane up
    // as the heading swept past perpendicular. leanAmount stays modest so
    // the wavefront (§7.1), not the lean, carries most of the gesture.
    float leanAmount = 0.32;
    float leanBig = mix(1.0, abs(dot(normalize(dirBig), uDir)), leanAmount);
    float leanCrs = mix(1.0, abs(dot(normalize(dirCrs), uDir)), leanAmount);
    float leanCh1 = mix(1.0, abs(dot(normalize(dirCh1), uDir)), leanAmount);
    float leanCh2 = mix(1.0, abs(dot(normalize(dirCh2), uDir)), leanAmount);
    float leanRp1 = mix(1.0, abs(dot(normalize(dirRp1), uDir)), leanAmount);
    float leanRp2 = mix(1.0, abs(dot(normalize(dirRp2), uDir)), leanAmount);

    float argBig = dot(dirBig, position.xy) * frqBig * leanBig + uTime * 0.24;
    float argCrs = dot(dirCrs, position.xy) * frqCrs * leanCrs + uTime * 0.17 + 1.7;
    float argCh1 = dot(dirCh1, position.xy) * frqCh1 * leanCh1 + uTime * 0.42 + 0.5;
    float argCh2 = dot(dirCh2, position.xy) * frqCh2 * leanCh2 + uTime * 0.51 + 3.0;
    float argRp1 = dot(dirRp1, position.xy) * frqRp1 * leanRp1 + uTime * 0.87;
    float argRp2 = dot(dirRp2, position.xy) * frqRp2 * leanRp2 + uTime * 0.99 + 2.2;

    float bigSwell  = sin(argBig) * ampBig;
    float crossSwell = sin(argCrs) * ampCrs;
    float chop1     = sin(argCh1) * ampCh1;
    float chop2     = sin(argCh2) * ampCh2;
    float ripple1   = sin(argRp1) * ampRp1;
    float ripple2   = sin(argRp2) * ampRp2;

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

    // ---- TRAVELING WAVEFRONT (§7.1) ----
    // A single swell band whose crest sweeps ALONG the conductor heading.
    // d is the distance of this vertex along uDir; the crest position is
    // d*frontFreq - frontSpeed*uTime, so as time advances the crest moves
    // up-heading — and as uDir turns (§6) the whole swell pivots to sweep
    // the new way. env(d) is a Gaussian centered on the plane so it stays
    // a BAND travelling through the middle, not a full-plane lift. Energy
    // is the music's body (bass+mid) so the gesture only swells with the
    // audio and rests flat when idle — the §6 heading still drifts so it's
    // never frozen, but the visible swell is audio-gated.
    float d = dot(uDir, position.xy);
    float frontEnergy = audioBass * 0.7 + audioMid * 0.5;
    float frontPhase = d * 0.55 - uTime * 1.6;
    float wavefront = sin(frontPhase) * exp(-d * d * 0.018) * frontEnergy;

    // Per-layer weights into the summed height. The gradient below MUST
    // use these same weights so the normal matches the surface we draw.
    float wBig = 0.85, wCrs = 0.55, wCh1 = 0.18, wCh2 = 0.14, wRp1 = 1.0, wRp2 = 1.0;

    // Sum the wave layers.
    float waveSum =
      bigSwell * wBig +
      crossSwell * wCrs +
      chop1 * wCh1 +
      chop2 * wCh2 +
      ripple1 * wRp1 +
      ripple2 * wRp2 +
      wavefront * 1.1 +
      radialPulse;

    // ---- ANALYTIC SURFACE NORMAL (§3) ----
    // Gradient of the height field in local x/y. For each wave term
    // sin(arg)*amp, d/dx = cos(arg) * dirX * freq * amp (chain rule).
    // We sum the same six terms with the same weights as the height.
    // The radial pulse and fbm texture are intentionally omitted: the
    // pulse is near-zero except mid-beat, and snoise has no cheap
    // analytic gradient — both contribute < 15% of the slope and would
    // only cost an extra noise eval. The surface light reads fine
    // without them.
    // (frequency factors include the §7.2 lean so the normal matches the
    // leaned surface — lean is constant in x/y so it passes through the
    // chain rule as a plain multiplier.)
    float dHdx =
      cos(argBig) * dirBig.x * frqBig * leanBig * ampBig * wBig +
      cos(argCrs) * dirCrs.x * frqCrs * leanCrs * ampCrs * wCrs +
      cos(argCh1) * dirCh1.x * frqCh1 * leanCh1 * ampCh1 * wCh1 +
      cos(argCh2) * dirCh2.x * frqCh2 * leanCh2 * ampCh2 * wCh2 +
      cos(argRp1) * dirRp1.x * frqRp1 * leanRp1 * ampRp1 * wRp1 +
      cos(argRp2) * dirRp2.x * frqRp2 * leanRp2 * ampRp2 * wRp2;
    float dHdy =
      cos(argBig) * dirBig.y * frqBig * leanBig * ampBig * wBig +
      cos(argCrs) * dirCrs.y * frqCrs * leanCrs * ampCrs * wCrs +
      cos(argCh1) * dirCh1.y * frqCh1 * leanCh1 * ampCh1 * wCh1 +
      cos(argCh2) * dirCh2.y * frqCh2 * leanCh2 * ampCh2 * wCh2 +
      cos(argRp1) * dirRp1.y * frqRp1 * leanRp1 * ampRp1 * wRp1 +
      cos(argRp2) * dirRp2.y * frqRp2 * leanRp2 * ampRp2 * wRp2;
    // Local-space normal: surface is z = H(x,y), so the (unnormalized)
    // normal is (-dHdx, -dHdy, 1). normalMatrix carries it to world
    // space (mesh has uniform scale, so this is exact).
    vec3 localNormal = normalize(vec3(-dHdx, -dHdy, 1.0));
    vNormal = normalize(normalMatrix * localNormal);

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
  varying vec3 vNormal;
  uniform float uBass;
  uniform float uHigh;
  uniform float uTheme;   // 0 = dark, 1 = light (eased in JS)
  uniform vec3 uFogColor; // horizon haze tint — matches the atmosphere bed so terrain dissolves into it (§2)

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

    // ---- ATMOSPHERIC DEPTH (§2) ----
    // Two-part falloff instead of one flat smoothstep band:
    //   1. nearFade — a soft ramp that just trims the very foreground so
    //      the closest lip doesn't over-bloom; full strength by ~3.5wu.
    //   2. haze — an EXPONENTIAL extinction toward the far plane, so the
    //      land doesn't end at a hard cutoff but DISSOLVES into a defined
    //      horizon (the "emerging from haze" read). exp(-d*k) never quite
    //      reaches 0, so distant ridges leave a faint glow in the mist
    //      rather than snapping to black.
    // depthFade is the line/surface coverage multiplier (keeps the old
    // name so the contour + fill math below is unchanged); hazeAmt is the
    // 0..1 "how much fog" used later to blend the colour toward uFogColor.
    float nearFade = smoothstep(1.5, 3.5, vCameraDist);
    float haze = exp(-max(vCameraDist - 3.5, 0.0) * 0.34);   // 1 near, ~0.1 by ~10wu
    float hazeAmt = 1.0 - haze;
    float depthFade = nearFade * haze;

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

    // ---- SURFACE FILL + SCULPTED LIGHT (§3) ----
    // The mesh between contour lines draws as a faint fill. Base term is
    // still height (peaks brighter than valleys) so the form reads even
    // on flats; on TOP we add a low, cold KEY light off the analytic
    // normal so ridges that FACE the light lift and faces turned away
    // fall to black. That's what turns the gradient into sculpted land.
    float surfaceShade = vHeightNorm * 0.20 + 0.03;  // base height fill (slightly lower so the light has headroom)

    // Low cold key: from the left, just above the horizon. Diffuse only;
    // no specular (this is matte land, not water-sheen). The light is a
    // dark-mode device — paper mode wants clean fill, so we gate it out.
    vec3 keyDir = normalize(vec3(-0.55, 0.40, 0.35));
    float key = max(dot(normalize(vNormal), keyDir), 0.0);
    // Gate the key to the high parts of the surface (vHeightNorm) so it
    // sculpts RIDGES rather than lifting the whole field — and clamp it,
    // so only genuine lit crests can approach the bloom threshold while
    // the inter-line fill stays well below it (guards the OLED bed).
    float ridgeLight = key * smoothstep(0.45, 0.95, vHeightNorm);
    surfaceShade += ridgeLight * 0.16 * (1.0 - uTheme);   // dark-mode sculpt only
    surfaceShade *= depthFade;
    surfaceShade *= rightMask;
    // Surface fill between the lines. Dark mode: a faint cool tint that
    // makes the 3D form readable on black, lifted toward a colder blue on
    // lit ridges (the key's colour). Light mode: we DROP this almost
    // entirely so clean paper shows between the lines — a grey fill there
    // just washes the contrast out and buries the lines. Fade it to ~0 as
    // uTheme→1.
    vec3 surfaceBase = vec3(0.14, 0.17, 0.23);   // ambient fill colour
    vec3 surfaceLit  = vec3(0.30, 0.40, 0.52);   // cold-blue lift where the key catches a ridge
    vec3 surfaceTint = mix(surfaceBase, surfaceLit, clamp(ridgeLight, 0.0, 1.0) * (1.0 - uTheme));
    float surfaceAlpha = surfaceShade * (1.0 - uTheme * 0.92);

    // ---- LINE COLOR ----
    // Dark mode: cold white-blue. On a beat, the site's ONE accent —
    // amber #b8845c — bleeds into the HIGH PARTS OF THE CREST only, so a
    // hit sends amber glow rippling along the ridgelines (the landscape
    // itself reacting) rather than warming every line into a flat wash.
    // That's both the DS "luminous terrain" note and the on-brand accent
    // rule (amber = shader peaks) in one move (§4). Light mode keeps its
    // restrained drawn-ink behaviour with a faint warm beat-tint.
    vec3 cool = vec3(0.889, 0.894, 0.902);   // #e3e4e6 — near-neutral, faintest cool
    vec3 amber = vec3(0.722, 0.518, 0.361);  // #b8845c — the sanctioned warm accent (shader peaks)
    vec3 warmGrey = vec3(0.600, 0.560, 0.510); // #998f82 — desaturated, for the paper bed
    vec3 inkLine = vec3(0.07, 0.065, 0.058); // near-black neutral ink for light

    // Amber gate (dark mode): a loud beat × a high crest. Both factors are
    // 0..1, so amber only appears where a tall ridge coincides with a hit
    // and fades back to cool as either subsides — it RIPPLES along the
    // crests as the waves move, instead of tinting the whole field. The
    // crest gate opens from 0.48 so the amber catches the upper SHOULDERS
    // of ridges (reads as a glow running along the ridgeline) not just the
    // single tallest pixels; capped below 1.0 so the brightest crests keep
    // a cool core and the amber stays an accent, never a flat wash.
    float beat = smoothstep(0.32, 0.7, uBass);
    float crest = smoothstep(0.48, 0.92, vHeightNorm);
    float amberMix = beat * crest * 0.85;
    vec3 darkLine = mix(cool, amber, amberMix);

    // Light mode: keep the prior subtle warm-grey beat tint (global, faint).
    float warmMix = smoothstep(0.5, 0.8, uBass);
    vec3 lightLine = mix(inkLine, warmGrey, warmMix * 0.7);
    vec3 lineColor = mix(darkLine, lightLine, uTheme);

    // ---- HORIZON LUMINANCE GRADIENT (§1) ----
    // The single highest-impact DS move: contours toward the horizon glow
    // BRIGHTER than the calm foreground, so the land reads as "emerging
    // luminous from haze" rather than as flat lines on flat black. Drive
    // off camera distance — a smooth lift that peaks in the mid-distance
    // band, just before §2's haze swallows the far ridges. Dark mode only;
    // on paper the ink should stay an even weight, not glow.
    float horizonGlow = mix(1.0, 1.85, smoothstep(3.0, 9.0, vCameraDist));
    lineColor *= mix(horizonGlow, 1.0, uTheme);

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

    // §2 — pull the colour toward the horizon haze tint with distance, so
    // far terrain meets the background seamlessly (a defined horizon)
    // rather than floating as dimmed lines on the bed. uFogColor matches
    // the atmosphere's bed colour (OLED black in dark, paper in light), so
    // terrain and background converge to the same value at the far plane.
    finalColor = mix(finalColor, uFogColor, hazeAmt);

    if (finalAlpha < 0.005) discard;
    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const levels = useAudioLevels();
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
      uBass: { value: 0 },
      uMid: { value: 0 },
      uHigh: { value: 0 },
      uPulse: { value: 0 },
      uTheme: { value: 0 },
      // Horizon haze tint (§2). Lerped per-theme in useFrame to match the
      // atmosphere bed so terrain dissolves into the background, not black.
      uFogColor: { value: new THREE.Color(0, 0, 0) },
      // Auto-conductor heading (§6) — a unit vec2 swept by an LFO in
      // useFrame. Starts pointing along +x.
      uDir: { value: new THREE.Vector2(1, 0) },
    };
    return { geometry: geo, uniforms: u };
  }, []);

  // Free GPU resources on unmount (tier/reduced-motion skips, future code
  // splits). The geometry is the memoized instance; the ShaderMaterial is the
  // one r3f builds from the <shaderMaterial> tag, reachable via matRef.
  useEffect(() => {
    return () => {
      geometry.dispose();
      matRef.current?.dispose();
    };
  }, [geometry]);

  // Dev guard: warn on any uniform declared here but never read by a shader
  // stage (the uScroll/uColor bug class). No-op in production.
  useEffect(() => {
    assertUniformsUsed("terrain", uniforms, vertexShader, fragmentShader);
  }, [uniforms]);

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

  // ---- AUTO-CONDUCTOR STATE (§6) ----
  // The baton. `phase` is accumulated by rate*delta each frame (NOT
  // t*rate, so a change in rate bends the sweep smoothly instead of
  // jumping it). `dir` is the eased heading the shader reads; we lerp it
  // toward the LFO target and renormalize so dot(uDir, pos) stays a true
  // projected distance even mid-turn.
  const condPhase = useRef(0);
  const condDir = useRef(new THREE.Vector2(1, 0));

  // Last pulse counter we acted on. The console buttons increment
  // levels.current.pulse via triggerPulse(); when this lags that, fire a
  // manual ripple (see useFrame). Lets a click "pluck" the surface when
  // no audio is driving it.
  const seenPulse = useRef(0);

  useFrame(({ clock }, delta) => {
    const mat = matRef.current;
    if (!mat) return;
    const u = mat.uniforms;
    u.uTime.value = clock.elapsedTime;

    // Ease theme mix toward target (0 dark / 1 light). 0.08/frame ≈ a
    // ~450ms settle at 60fps, matching the CSS token transition.
    const themeTarget = theme === "light" ? 1 : 0;
    themeMix.current += (themeTarget - themeMix.current) * 0.08;
    u.uTheme.value = themeMix.current;

    // Horizon haze tint follows the eased theme between the atmosphere's
    // dark bed (#000) and its paper bed (#f2f1ef ≈ 0.949,0.945,0.937), so
    // far terrain dissolves into whatever the background actually is.
    const fog = u.uFogColor.value;
    const m = themeMix.current;
    fog.setRGB(0.949 * m, 0.945 * m, 0.937 * m);

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

    // ---- AUTO-CONDUCTOR LFO (§6) ----
    // The baton sweeps the heading left<->right on its own, so the scene
    // always looks conducted even at idle; the SWEEP RATE rises with the
    // eased mid level, so a busy passage visibly cues faster and a calm
    // one drifts slow. We accumulate phase by rate*delta (frame-rate
    // independent, and continuous when rate changes), then:
    //   angle = swing*sin(phase) + a slow off-ratio 2nd harmonic so the
    //           gesture never feels metronomic.
    //   dir   = (cos angle, sin angle), eased toward + renormalized so it
    //           turns smoothly and never snaps or de-normalizes.
    // dt is clamped so a long stall (backgrounded tab resuming) can't
    // fling the phase forward in one step.
    const dt = Math.min(delta, 0.05);
    const BASE_RATE = 0.22;          // idle sweep speed (rad/s of phase)
    const RATE_GAIN = 1.1;           // how much mid energy speeds the baton
    const MAX_RATE = 1.4;            // clamp so loud passages never strobe
    const SWING = 1.05;              // ±60° — gestures left<->right, never spins
    const rate = Math.min(BASE_RATE + ampMid.current * RATE_GAIN, MAX_RATE);
    condPhase.current += rate * dt;
    const angle =
      SWING * Math.sin(condPhase.current) +
      SWING * 0.3 * Math.sin(condPhase.current * 0.37 + 1.1);
    const tx = Math.cos(angle);
    const ty = Math.sin(angle);
    // Ease toward the target heading (smooth turn), then renormalize.
    const dir = condDir.current;
    dir.x += (tx - dir.x) * 0.06;
    dir.y += (ty - dir.y) * 0.06;
    const len = Math.hypot(dir.x, dir.y) || 1;
    dir.x /= len;
    dir.y /= len;
    (u.uDir.value as THREE.Vector2).set(dir.x, dir.y);

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
