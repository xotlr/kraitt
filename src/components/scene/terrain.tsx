"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  abs,
  add,
  cameraPosition,
  clamp,
  cos,
  Discard,
  dot,
  exp,
  float,
  floor,
  Fn,
  fract,
  fwidth,
  length,
  Loop,
  max,
  mix as tslMix,
  modelNormalMatrix,
  modelWorldMatrix,
  mul,
  normalize,
  oneMinus,
  positionGeometry,
  pow,
  sin,
  smoothstep,
  uniform,
  varying,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type Node } from "three/webgpu";
import { useAudioLevels } from "@/lib/audio";
import { useThemeMix } from "@/hooks/use-theme-mix";
import { snoise3 } from "./tsl-noise";

/**
 * Terrain — a real 3D plane laid flat on the ground, displaced by layered
 * traveling waves into an audio-reactive ocean. The fragment node draws gold
 * contour lines at fixed world-y intervals; because the surface is genuinely
 * 3D, contour density varies with slope (lines crowd on peaks, spread on
 * flats). Ported to TSL so it runs on the WebGPU renderer.
 *
 * Scroll motion is supplied by the camera dolly in CameraRig, not here — the
 * terrain field evolves in place (waves + FBM over a time axis) and the camera
 * travels across it as the page scrolls.
 *
 * Audio reactivity:
 *   - bass: amplifies displacement (peaks rise) + tightens contour spacing
 *   - mid:  speeds noise drift + the conductor sweep
 *   - high: sharpens contour line edges + scatters the ripples
 *
 * References:
 *   - The Book of Shaders, "Truchet / Contour" patterns
 *   - Inigo Quilez, "Filtering a contour" / "Elevated"
 */

const PLANE_SIZE = 30; // world-units wide and deep
const SEGMENTS = 160; // 160x160 ≈ 25k tris (the perf-audited segment count).

// Concrete uniform types (via the factory's ReturnType) so the node-element
// methods (.mul/.x/...) resolve — `ReturnType<typeof uniform>` alone collapses
// the generic to unknown and drops them.
function makeUniforms() {
  return {
    uTime: uniform(0),
    uBass: uniform(0),
    uMid: uniform(0),
    uHigh: uniform(0),
    uPulse: uniform(0),
    uTheme: uniform(0),
    // Horizon haze tint — lerped per-theme to match the atmosphere bed.
    uFogColor: uniform(new THREE.Color(0, 0, 0)),
    // Auto-conductor heading — a unit vec2 swept by an LFO. Starts at +x.
    uDir: uniform(new THREE.Vector2(1, 0)),
  };
}
type Uniforms = ReturnType<typeof makeUniforms>;

// FBM that takes time as the z-axis of 3D simplex noise — what makes the
// terrain genuinely EVOLVE in place rather than translate. Each octave
// advances at a faster time rate (small detail boils faster, large structure
// drifts slower).
const fbm = Fn(([p, t]: [Node<"vec2">, Node<"float">]) => {
  const v = float(0).toVar();
  const a = float(0.55).toVar();
  const tz = t.toVar();
  const pp = p.toVar();
  Loop(4, () => {
    v.addAssign(a.mul(snoise3(vec3(pp, tz))));
    pp.assign(pp.mul(1.9).add(vec2(31.4, 17.7)));
    a.mulAssign(0.5);
    tz.mulAssign(1.6); // higher octaves animate faster
  });
  return v;
});

// ---- varyings the vertex node writes and the fragment node reads ----
const vWorldY = varying(float(0));
const vWorldPos = varying(vec3(0));
const vCameraDist = varying(float(0));
const vHeightNorm = varying(float(0));
const vNormal = varying(vec3(0));

/**
 * The displacement + analytic-normal computation, shared by positionNode (it
 * returns the displaced local position) and — via the varyings it writes — the
 * fragment colour. Mirrors the original GLSL main() exactly.
 */
function buildVertexNode(u: Uniforms) {
  return Fn(() => {
    const position = positionGeometry; // local XY plane (pre-rotation)

    // ---- AUDIO OCEAN ---- (gentle gamma; keeps a toe to suppress noise but
    // lets real beats through close to 1:1)
    const bassEase = pow(u.uBass, 1.1);
    const midEase = pow(u.uMid, 1.1);
    const highEase = pow(u.uHigh, 1.1);

    // ---- SPATIAL AUDIO ENERGY ---- each band's energy travels across the
    // surface as a moving field, so a hit reads as a wavefront sweeping the
    // water rather than the whole surface lifting at once.
    const bassField = add(
      0.5,
      mul(0.5, sin(dot(vec2(0.9, 0.35), position.xy).mul(0.22).sub(u.uTime.mul(0.3))))
    );
    const midField = add(
      0.5,
      mul(0.5, sin(dot(vec2(-0.4, 0.95), position.xy).mul(0.4).add(u.uTime.mul(0.55))))
    );
    const highField = add(
      0.5,
      mul(
        0.5,
        sin(dot(vec2(0.6, -0.8), position.xy).mul(0.7).add(u.uTime.mul(0.95)).add(1.3))
      )
    );

    // Band energy = global level shaped by its traveling field. High floor
    // (0.7) so a beat lifts the whole surface; field adds ~40% where it peaks.
    const audioBass = bassEase.mul(add(0.7, bassField.mul(0.4))).toVar();
    const audioMid = midEase.mul(add(0.7, midField.mul(0.4))).toVar();
    const audioHigh = highEase.mul(add(0.7, highField.mul(0.4))).toVar();

    // ---- DIFFRACTION vs. LOCALIZATION ---- long (bass) waves diffract and
    // reach the far field; short (high) waves stay near the source. Gate each
    // band by a radial envelope from the origin (the sound "source").
    const radius = length(position.xy).toVar();
    const bassReach = exp(radius.mul(-0.045));
    const midReach = exp(radius.mul(-0.16));
    const highReach = exp(radius.mul(-0.42));
    audioBass.mulAssign(add(0.45, bassReach.mul(0.55)));
    audioMid.mulAssign(add(0.3, midReach.mul(0.7)));
    audioHigh.mulAssign(highReach);

    // Wave params. Each wave: sin(dot(D, pos.xy)*F + uTime*S + phase) * Amp.
    const dirBig = vec2(1.0, 0.2);
    const frqBig = float(0.28);
    const ampBig = add(0.14, audioBass.mul(1.3)).toVar();
    const dirCrs = vec2(0.3, 1.0);
    const frqCrs = float(0.34);
    const ampCrs = add(0.1, audioBass.mul(0.85)).toVar();
    const dirCh1 = vec2(0.7, -0.7);
    const frqCh1 = float(0.9);
    const ampCh1 = add(0.05, audioMid.mul(0.9)).toVar();
    const dirCh2 = vec2(-0.5, 0.85);
    const frqCh2 = float(1.05);
    const ampCh2 = add(0.04, audioMid.mul(0.7)).toVar();
    const dirRp1 = vec2(0.9, 0.4);
    const frqRp1 = float(2.2);
    const ampRp1 = add(0.025, audioHigh.mul(0.35)).toVar();
    const dirRp2 = vec2(-0.6, 0.8);
    const frqRp2 = float(2.8);
    const ampRp2 = add(0.02, audioHigh.mul(0.25)).toVar();

    // ---- ANISOTROPIC LEAN ---- bias each wave's frequency toward the
    // conductor heading; mix from 1.0 so a perpendicular wave doesn't collapse
    // to a flat DC offset.
    const leanAmount = float(0.32);
    const lean = (d: Node<"vec2">) =>
      tslMix(float(1.0), abs(dot(normalize(d), u.uDir)), leanAmount);
    const leanBig = lean(dirBig).toVar();
    const leanCrs = lean(dirCrs).toVar();
    const leanCh1 = lean(dirCh1).toVar();
    const leanCh2 = lean(dirCh2).toVar();
    const leanRp1 = lean(dirRp1).toVar();
    const leanRp2 = lean(dirRp2).toVar();

    // The two SWELL bands (bass) propagate straight — long waves pass through.
    const argBig = dot(dirBig, position.xy).mul(frqBig).mul(leanBig).add(u.uTime.mul(0.24)).toVar();
    const argCrs = dot(dirCrs, position.xy).mul(frqCrs).mul(leanCrs).add(u.uTime.mul(0.17)).add(1.7).toVar();

    // ---- SCATTER / REFRACTION ---- short waves glance off the swell's slope;
    // long waves don't. Deflect each ripple's heading by the bass-swell
    // gradient (perpendicular-biased), gated by the high energy.
    const swellSlope = cos(argBig)
      .mul(dirBig)
      .mul(frqBig)
      .mul(leanBig)
      .mul(ampBig)
      .add(cos(argCrs).mul(dirCrs).mul(frqCrs).mul(leanCrs).mul(ampCrs))
      .toVar();
    const deflect = vec2(swellSlope.y.negate(), swellSlope.x);
    const dirRp1d = normalize(dirRp1.add(deflect.mul(audioHigh.mul(3.2)))).toVar();
    const dirRp2d = normalize(dirRp2.add(deflect.mul(audioHigh.mul(3.8)))).toVar();
    const dirCh1d = normalize(dirCh1.add(deflect.mul(audioMid.mul(1.1)))).toVar();
    const dirCh2d = normalize(dirCh2.add(deflect.mul(audioMid.mul(1.3)))).toVar();

    // Recompute chop/ripple args off the DEFLECTED headings.
    const argCh1s = dot(dirCh1d, position.xy).mul(frqCh1).mul(leanCh1).add(u.uTime.mul(0.42)).add(0.5).toVar();
    const argCh2s = dot(dirCh2d, position.xy).mul(frqCh2).mul(leanCh2).add(u.uTime.mul(0.51)).add(3.0).toVar();
    const argRp1 = dot(dirRp1d, position.xy).mul(frqRp1).mul(leanRp1).add(u.uTime.mul(0.87)).toVar();
    const argRp2 = dot(dirRp2d, position.xy).mul(frqRp2).mul(leanRp2).add(u.uTime.mul(0.99)).add(2.2).toVar();

    const bigSwell = sin(argBig).mul(ampBig);
    const crossSwell = sin(argCrs).mul(ampCrs);
    const chop1 = sin(argCh1s).mul(ampCh1);
    const chop2 = sin(argCh2s).mul(ampCh2);
    const ripple1 = sin(argRp1).mul(ampRp1);
    const ripple2 = sin(argRp2).mul(ampRp2);

    // ---- RADIAL BEAT PULSE ---- a ring expands from the origin on a hit.
    const ringPhase = radius.mul(1.1).sub(u.uPulse.mul(9.0));
    const ringEnv = u.uPulse.mul(oneMinus(u.uPulse));
    const radialPulse = sin(ringPhase).mul(exp(radius.mul(-0.18))).mul(ringEnv).mul(1.6);

    // ---- TRAVELING WAVEFRONT ---- a swell band whose crest sweeps ALONG the
    // conductor heading; a Gaussian band centred on the plane. Audio-gated.
    const d = dot(u.uDir, position.xy).toVar();
    const frontEnergy = audioBass.mul(0.7).add(audioMid.mul(0.5));
    const frontPhase = d.mul(0.55).sub(u.uTime.mul(1.6));
    const wavefront = sin(frontPhase).mul(exp(d.mul(d).mul(-0.018))).mul(frontEnergy);

    // Per-layer weights into the summed height. The gradient below uses the
    // SAME weights so the normal matches the surface we draw.
    const wBig = 0.85, wCrs = 0.55, wCh1 = 0.18, wCh2 = 0.14, wRp1 = 1.0, wRp2 = 1.0;

    const waveSum = bigSwell
      .mul(wBig)
      .add(crossSwell.mul(wCrs))
      .add(chop1.mul(wCh1))
      .add(chop2.mul(wCh2))
      .add(ripple1.mul(wRp1))
      .add(ripple2.mul(wRp2))
      .add(wavefront.mul(1.1))
      .add(radialPulse);

    // ---- ANALYTIC SURFACE NORMAL ---- gradient of the height field. For each
    // wave sin(arg)*amp, d/dx = cos(arg)*dirX*freq*amp. Same six terms, same
    // weights as the height. The pulse + fbm texture are omitted (< 15% of the
    // slope, and snoise has no cheap analytic gradient).
    const dHdx = cos(argBig).mul(dirBig.x).mul(frqBig).mul(leanBig).mul(ampBig).mul(wBig)
      .add(cos(argCrs).mul(dirCrs.x).mul(frqCrs).mul(leanCrs).mul(ampCrs).mul(wCrs))
      .add(cos(argCh1s).mul(dirCh1d.x).mul(frqCh1).mul(leanCh1).mul(ampCh1).mul(wCh1))
      .add(cos(argCh2s).mul(dirCh2d.x).mul(frqCh2).mul(leanCh2).mul(ampCh2).mul(wCh2))
      .add(cos(argRp1).mul(dirRp1d.x).mul(frqRp1).mul(leanRp1).mul(ampRp1).mul(wRp1))
      .add(cos(argRp2).mul(dirRp2d.x).mul(frqRp2).mul(leanRp2).mul(ampRp2).mul(wRp2));
    const dHdy = cos(argBig).mul(dirBig.y).mul(frqBig).mul(leanBig).mul(ampBig).mul(wBig)
      .add(cos(argCrs).mul(dirCrs.y).mul(frqCrs).mul(leanCrs).mul(ampCrs).mul(wCrs))
      .add(cos(argCh1s).mul(dirCh1d.y).mul(frqCh1).mul(leanCh1).mul(ampCh1).mul(wCh1))
      .add(cos(argCh2s).mul(dirCh2d.y).mul(frqCh2).mul(leanCh2).mul(ampCh2).mul(wCh2))
      .add(cos(argRp1).mul(dirRp1d.y).mul(frqRp1).mul(leanRp1).mul(ampRp1).mul(wRp1))
      .add(cos(argRp2).mul(dirRp2d.y).mul(frqRp2).mul(leanRp2).mul(ampRp2).mul(wRp2));
    // Local normal: surface is z = H(x,y) → (-dHdx, -dHdy, 1). modelNormalMatrix
    // carries it to world space (uniform scale, so exact).
    const localNormal = normalize(vec3(dHdx.negate(), dHdy.negate(), 1.0));
    vNormal.assign(normalize(modelNormalMatrix.mul(localNormal)));

    // Water texture — soft broad FBM on top of the sines.
    const texture = fbm(position.xy.mul(0.35), u.uTime.mul(0.13)).mul(0.06);
    const displaced = waveSum.add(texture).toVar();

    const newPos = vec3(position.x, position.y, displaced);
    const worldPos = modelWorldMatrix.mul(vec4(newPos, 1.0));
    vWorldPos.assign(worldPos.xyz);
    vWorldY.assign(worldPos.y);
    // Normalize wave height to 0..1 (crests=1, troughs=0).
    vHeightNorm.assign(clamp(displaced.mul(0.25).add(0.5), 0.0, 1.0));
    vCameraDist.assign(length(cameraPosition.sub(worldPos.xyz)));

    return newPos;
  });
}

/**
 * Fragment colour — contour lines + sculpted surface fill + horizon glow +
 * haze, reading the varyings above. Mirrors the original fragment main().
 */
function buildColorNode(u: Uniforms) {
  return Fn(() => {
    // Contour spacing — bass tightens it (lines crowd on beats), clamped so it
    // can't collapse below 30% of base.
    const baseSpacing = float(0.04);
    const spacing = baseSpacing.mul(oneMinus(clamp(u.uBass.mul(1.4), 0.0, 0.55)));
    const ratio = vWorldY.div(spacing).toVar();
    const distNorm = abs(fract(ratio).sub(0.5));

    // ---- ATMOSPHERIC DEPTH ---- nearFade trims the foreground; haze is an
    // exponential extinction toward the far plane so land DISSOLVES into the
    // horizon rather than hard-cutting.
    const nearFade = smoothstep(1.5, 3.5, vCameraDist);
    const haze = exp(max(vCameraDist.sub(3.5), 0.0).mul(-0.34));
    const hazeAmt = oneMinus(haze);
    const depthFade = nearFade.mul(haze).toVar();

    // Pixel-stable line width via screen-space derivatives.
    const widthScale = tslMix(float(0.95), float(0.45), depthFade);
    const w = fwidth(ratio).mul(widthScale).mul(oneMinus(u.uHigh.mul(0.3))).toVar();
    const line = oneMinus(smoothstep(w.mul(0.5), w, distNorm)).toVar();

    // Per-line opacity jitter so density visibly varies.
    const lineId = floor(ratio);
    const lineJitter = add(0.55, mul(0.45, fract(sin(lineId.mul(12.9898)).mul(43758.5453))));
    line.mulAssign(lineJitter);
    line.mulAssign(depthFade);

    // Right-side mask, softened — lines bleed leftward at 25% so the wordmark
    // reads against a faint continuation, not a hard cutoff.
    const rightMask = tslMix(float(0.25), float(1.0), smoothstep(-2.5, 2.5, vWorldPos.x));
    line.mulAssign(rightMask);

    // ---- SURFACE FILL + SCULPTED LIGHT ---- faint fill between lines; a low
    // cold key light off the analytic normal lifts ridges that face it.
    const surfaceShade = vHeightNorm.mul(0.2).add(0.03).toVar();
    const keyDir = normalize(vec3(-0.55, 0.4, 0.35));
    const key = max(dot(normalize(vNormal), keyDir), 0.0);
    const ridgeLight = key.mul(smoothstep(0.45, 0.95, vHeightNorm)).toVar();
    surfaceShade.addAssign(ridgeLight.mul(0.16).mul(oneMinus(u.uTheme))); // dark-mode sculpt
    surfaceShade.mulAssign(depthFade);
    surfaceShade.mulAssign(rightMask);
    const surfaceBase = vec3(0.14, 0.17, 0.23);
    const surfaceLit = vec3(0.3, 0.4, 0.52);
    const surfaceTint = tslMix(
      surfaceBase,
      surfaceLit,
      clamp(ridgeLight, 0.0, 1.0).mul(oneMinus(u.uTheme))
    );
    const surfaceAlpha = surfaceShade.mul(oneMinus(u.uTheme.mul(0.92)));

    // ---- LINE COLOR ---- dark: cold white-blue, amber bleeds into lit crests
    // on a beat. Light: drawn-ink with a faint warm beat tint.
    const cool = vec3(0.889, 0.894, 0.902);
    const amber = vec3(0.722, 0.518, 0.361);
    const warmGrey = vec3(0.6, 0.56, 0.51);
    const inkLine = vec3(0.07, 0.065, 0.058);

    const beat = smoothstep(0.32, 0.7, u.uBass);
    const crest = smoothstep(0.48, 0.92, vHeightNorm);
    const amberMix = beat.mul(crest).mul(0.85);
    const darkLine = tslMix(cool, amber, amberMix);

    const warmMix = smoothstep(0.5, 0.8, u.uBass);
    const lightLine = tslMix(inkLine, warmGrey, warmMix.mul(0.7));
    const lineColor = tslMix(darkLine, lightLine, u.uTheme).toVar();

    // ---- HORIZON LUMINANCE GRADIENT ---- contours toward the horizon glow
    // brighter so the land reads as emerging luminous from haze. Dark only.
    const horizonGlow = tslMix(float(1.0), float(1.85), smoothstep(3.0, 9.0, vCameraDist));
    lineColor.mulAssign(tslMix(horizonGlow, float(1.0), u.uTheme));

    // Line alpha — dark lifted to 1.35×, light ~2.8×.
    const lineAlpha = line.mul(tslMix(float(1.35), float(2.8), u.uTheme));

    // Composite line over surface fill as proper coverage.
    const finalAlpha = max(surfaceAlpha, lineAlpha).toVar();
    const lineFrac = finalAlpha.greaterThan(0.0001).select(lineAlpha.div(finalAlpha), float(0.0));
    const finalColor = tslMix(surfaceTint, lineColor, lineFrac).toVar();

    // Pull the colour toward the horizon haze tint with distance so far
    // terrain meets the background seamlessly.
    finalColor.assign(tslMix(finalColor, u.uFogColor, hazeAmt));

    Discard(finalAlpha.lessThan(0.005));
    return vec4(finalColor, finalAlpha);
  });
}

export function Terrain() {
  const levels = useAudioLevels();

  // Material/geometry/uniforms are mutable GPU state written every frame, so
  // they live in a lazily-initialised ref (not useMemo) — the externally-
  // mutable store the per-frame uniform writes belong to.
  const store = useRef<{
    material: MeshBasicNodeMaterial;
    geometry: THREE.PlaneGeometry;
    uniforms: Uniforms;
  } | null>(null);
  if (store.current === null) {
    const geometry = new THREE.PlaneGeometry(
      PLANE_SIZE,
      PLANE_SIZE,
      SEGMENTS,
      SEGMENTS
    );
    const uniforms = makeUniforms();
    const material = new MeshBasicNodeMaterial();
    material.positionNode = buildVertexNode(uniforms)();
    material.colorNode = buildColorNode(uniforms)();
    material.transparent = true;
    material.depthWrite = false;
    material.side = THREE.FrontSide;
    store.current = { material, geometry, uniforms };
  }
  const { material, geometry, uniforms } = store.current;

  // Shared eased theme transition (0 dark / 1 light); written into uTheme + the
  // fog colour in the useFrame below.
  const themeMix = useThemeMix();

  // Free GPU resources on unmount.
  useEffect(() => {
    return () => {
      geometry.dispose();
      material.dispose();
    };
  }, [geometry, material]);

  // ---- per-frame audio + conductor + pulse state ----
  const prevBass = useRef(0);
  const pulse = useRef(0);
  const pulseActive = useRef(false);
  const ampBass = useRef(0);
  const ampMid = useRef(0);
  const ampHigh = useRef(0);
  const condPhase = useRef(0);
  const condDir = useRef(new THREE.Vector2(1, 0));
  const seenPulse = useRef(0);

  useFrame(({ clock }, delta) => {
    const u = uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uTheme.value = themeMix.current;

    // Horizon haze tint follows the eased theme between the atmosphere's dark
    // bed (#000) and paper bed (≈0.949,0.945,0.937) so terrain dissolves into
    // whatever the background actually is. themeMix is the shared eased ref.
    const m = themeMix.current;
    u.uFogColor.value.setRGB(0.949 * m, 0.945 * m, 0.937 * m);

    // Ease band amplitudes toward live levels — attack-heavy (tracks the beat)
    // but slow release (ebbs out like real water) so the surface swells with a
    // hit instead of snapping.
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

    // ---- AUTO-CONDUCTOR LFO ---- the baton sweeps the heading on its own; the
    // sweep rate rises with eased mid so a busy passage cues faster. Phase
    // accumulated by rate*delta (frame-rate independent, continuous on rate
    // change). dt clamped so a resuming backgrounded tab can't fling it.
    const dt = Math.min(delta, 0.05);
    const BASE_RATE = 0.22;
    const RATE_GAIN = 1.1;
    const MAX_RATE = 1.4;
    const SWING = 1.05;
    const rate = Math.min(BASE_RATE + ampMid.current * RATE_GAIN, MAX_RATE);
    condPhase.current += rate * dt;
    const angle =
      SWING * Math.sin(condPhase.current) +
      SWING * 0.3 * Math.sin(condPhase.current * 0.37 + 1.1);
    const tx = Math.cos(angle);
    const ty = Math.sin(angle);
    const dir = condDir.current;
    dir.x += (tx - dir.x) * 0.06;
    dir.y += (ty - dir.y) * 0.06;
    const len = Math.hypot(dir.x, dir.y) || 1;
    dir.x /= len;
    dir.y /= len;
    u.uDir.value.set(dir.x, dir.y);

    // ---- RADIAL PULSE TRIGGER ---- note onset (Meyda), bass surge fallback,
    // or a manual console pluck launches one expanding ring at a time.
    const bassNow = levels.current.bass;
    const noteOnset = levels.current.onset > 0.22;
    const bassSurge = bassNow - prevBass.current > 0.18 && bassNow > 0.35;
    const onset = noteOnset || bassSurge;
    const plucked = levels.current.pulse !== seenPulse.current;
    seenPulse.current = levels.current.pulse;
    if ((onset || plucked) && !pulseActive.current) {
      pulseActive.current = true;
      pulse.current = 0;
    }
    prevBass.current = bassNow;
    if (pulseActive.current) {
      pulse.current += 0.012; // ~1.4s to expand + fade, then disarm
      if (pulse.current >= 1) {
        pulse.current = 0;
        pulseActive.current = false;
      }
    }
    u.uPulse.value = pulse.current;
  });

  return (
    <mesh
      geometry={geometry}
      material={material}
      // PlaneGeometry is XY-aligned; rotate -90° around X so it lies flat on
      // the XZ ground plane with local-Y forward. The vertex node writes Z,
      // which after this rotation becomes world-up.
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, 0, 0]}
      frustumCulled={false}
    />
  );
}
