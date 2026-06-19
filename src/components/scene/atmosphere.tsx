"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import {
  add,
  float,
  Fn,
  Loop,
  mix as tslMix,
  oneMinus,
  positionGeometry,
  smoothstep,
  uniform,
  uv,
  vec3,
  vec4,
} from "three/tsl";
import { MeshBasicNodeMaterial, type Node } from "three/webgpu";
import { useAudioLevels } from "@/lib/audio";
import { useThemeMix } from "@/hooks/use-theme-mix";
import { snoise3 } from "./tsl-noise";

/**
 * Atmosphere — the OLED-black bed (or warm paper, in light mode): a fullscreen
 * quad whose fragment colour is sparse warm pockets over a flat bed, plus a
 * cold ground-fog band at the floor so the terrain has a defined horizon to sit
 * in. Built in TSL so it runs on the WebGPU renderer.
 *
 * Why a quad and not a clear colour: the bed is procedural (drifting FBM
 * pockets + the §5 fog band), not a constant, so it has to be shaded.
 *
 * Audio reactivity:
 *  - uBass: brightens the warm pockets on beats.
 */

// Concrete uniform types via the factory's ReturnType so node-element methods
// (.mul/.x/...) resolve — `ReturnType<typeof uniform>` alone collapses the
// generic to unknown and drops them.
function makeUniforms() {
  return {
    uTime: uniform(0),
    uResolution: uniform(new THREE.Vector2(1, 1)),
    uBass: uniform(0),
    uTheme: uniform(0),
  };
}
type Uniforms = ReturnType<typeof makeUniforms>;

// --- node-graph fragment colour, authored once, reused as the material's
// colorNode. Uniform handles are created in the component and closed over. ---
function buildColorNode(u: Uniforms) {
  // 2-octave FBM. Cheap; the visual interest comes from the pockets + fog, not
  // from stacking octaves.
  const fbm = Fn(([p]: [Node<"vec3">]) => {
    const v = float(0).toVar();
    const amp = float(0.6).toVar();
    const pp = p.toVar();
    const shift = vec3(100.0);
    Loop(2, () => {
      v.addAssign(amp.mul(snoise3(pp)));
      pp.assign(pp.mul(1.9).add(shift));
      amp.mulAssign(0.5);
    });
    return v;
  });

  return Fn(() => {
    const vUv = uv();
    const aspect = u.uResolution.x.div(u.uResolution.y);
    const p = vec3(vUv.x.mul(aspect), vUv.y, u.uTime.mul(0.04));

    const n = fbm(p.mul(vec3(1.4, 1.4, 1.0))).toVar();

    // Bed + sparse pockets. Dark: OLED black w/ faint warm pockets. Light:
    // warm paper with faint warm-darker pockets so the field reads on white.
    const bgDark = vec3(0.0);
    const bgLight = vec3(0.949, 0.945, 0.937); // near-neutral paper grey
    const bg = tslMix(bgDark, bgLight, u.uTheme);
    const pocketDark = vec3(0.016, 0.015, 0.013); // faint neutral lift
    const pocketLight = vec3(0.885, 0.875, 0.86); // dip toward neutral grey
    const pocketColor = tslMix(pocketDark, pocketLight, u.uTheme);
    const pocket = smoothstep(0.94, 1.0, n.mul(0.5).add(0.5));
    const pocketBoost = add(1.0, u.uBass.mul(0.6));
    const col = tslMix(bg, pocketColor.mul(pocketBoost), pocket).toVar();

    // ---- GROUND-FOG HAZE BAND (§5) ----
    // Lift the lower third of the bed by a hair of cold near-black so the
    // terrain emerges from a defined horizon rather than a dead flat void.
    // vUv.y is 0 at the bottom; the band ramps in below ~0.45. Broken up by
    // the FBM so it drifts like real haze. Dark mode only.
    const fogBand = smoothstep(0.45, 0.0, vUv.y);
    const fogBreakup = add(0.7, n.mul(0.5).add(0.5).mul(0.3));
    const groundFog = vec3(0.018, 0.022, 0.03);
    col.addAssign(
      groundFog.mul(fogBand).mul(fogBreakup).mul(oneMinus(u.uTheme))
    );

    // Film grain is NOT here — it's a single page-wide GPU overlay
    // (components/grain-overlay.tsx) so it grains the scene, console chrome,
    // and editorial type as one film layer. Keeping it out avoids
    // double-graining the scene area.
    return vec4(col.max(vec3(0.0)), 1.0);
  })();
}

export function Atmosphere() {
  const levels = useAudioLevels();

  // Node materials live in three/webgpu, not the core THREE namespace r3f
  // auto-extends, so we build the material imperatively and attach it to the
  // mesh rather than via a <meshBasicNodeMaterial> JSX tag. The material +
  // uniforms are mutable GPU state we write to every frame, so they live in a
  // lazily-initialised ref (not useMemo) — that's the externally-mutable store
  // the per-frame uniform writes belong to.
  const store = useRef<{
    material: MeshBasicNodeMaterial;
    uniforms: ReturnType<typeof makeUniforms>;
  } | null>(null);
  if (store.current === null) {
    const uniforms = makeUniforms();
    const material = new MeshBasicNodeMaterial();
    material.colorNode = buildColorNode(uniforms);
    // Fullscreen quad — write clip-space positions directly, bypass the camera
    // (positionGeometry is the [-1,1] quad).
    material.vertexNode = vec4(positionGeometry.xy, 0.0, 1.0);
    material.depthTest = false;
    material.depthWrite = false;
    store.current = { material, uniforms };
  }
  const { material, uniforms } = store.current;

  // Shared eased theme transition (0 dark / 1 light); we write it into our own
  // uniform in the useFrame below.
  const themeMix = useThemeMix();

  // Free GPU resources on unmount (tier/reduced-motion skips).
  useEffect(() => () => material.dispose(), [material]);

  useFrame(({ clock, size }) => {
    const u = uniforms;
    u.uTime.value = clock.elapsedTime;
    u.uResolution.value.set(size.width, size.height);
    u.uBass.value = levels.current.bass;
    u.uTheme.value = themeMix.current;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1} material={material}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
