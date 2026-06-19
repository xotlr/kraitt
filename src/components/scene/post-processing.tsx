"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import * as THREE from "three";
import {
  float,
  hue,
  mix as tslMix,
  pass,
  renderOutput,
  saturation,
  screenUV,
  smoothstep,
  vec2,
} from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { RenderPipeline } from "three/webgpu";

/**
 * PostProcessing — the WebGPU node-graph port of the old @react-three/
 * postprocessing EffectComposer stack. Same passes, same tuning, same order:
 *
 *   pass(scene) → Bloom (selective crests) → ChromaticAberration (edge fringe)
 *   → SMAA → AgX tone map + sRGB → HueSaturation (-8% sat, cool shift)
 *   → Vignette (corners only).
 *
 * @react-three/postprocessing has no WebGPU backend, so the composer is
 * rebuilt here as three's `RenderPipeline` node graph. We hook the renderer's
 * render call: under frameloop="demand" r3f's default render is replaced so
 * the FrameCap pump's invalidate() drives `pipeline.render()` instead of a raw
 * scene render. The graph is built once on mount (passes are static).
 */
export function PostFxPipeline() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);

  useEffect(() => {
    // pass renders the scene+camera into an offscreen texture node.
    const scenePass = pass(scene, camera);
    const sceneColor = scenePass.getTextureNode("output");

    // Bloom — selective. Threshold keeps the dim surface fill + cold ridge
    // lift below it so only bright contour crests bloom (bloom the lines, not
    // the OLED bed). (strength 0.9, radius ~LARGE → 0.85, threshold 0.28 —
    // matches the old <Bloom intensity={0.9} luminanceThreshold={0.28}/>.)
    const bloomPass = bloom(sceneColor, 0.9, 0.85, 0.28);

    // Composite: scene + additive bloom (SCREEN blend was the old blendFunction).
    const withBloom = sceneColor.add(bloomPass);

    // Chromatic aberration — pulled way back: subtle edge fringe only. scale
    // 1.1 keeps the inner frame clean; low strength = small fringe magnitude.
    // center MUST be an explicit node — passing null trips a null-deref in
    // ChromaticAberrationNode.generate() in this three build. Frame centre is
    // (0.5, 0.5) in screen-UV space.
    const ca = chromaticAberration(withBloom, float(1.0), vec2(0.5, 0.5), float(1.1));

    // SMAA — subpixel morphological AA on the contour lines.
    const aa = smaa(ca);

    // AgX tone map (true black point — #000 stays #000) + sRGB output. Runs on
    // the post-bloom buffer, the correct order for filmic highlights.
    const graded = renderOutput(aa, THREE.AgXToneMapping, THREE.SRGBColorSpace);

    // HueSaturation — slight desaturation (-8%) + a tiny cool hue shift, for a
    // film-print neutral. (hue is in radians; -0.02 ≈ the old -0.02 shift.)
    const hueSat = hue(saturation(graded, 0.92), -0.02);

    // Vignette — corners only. Radial falloff from centre: clean until ~55%,
    // darkens to ~28% at the corners. screenUV is 0..1 across the frame.
    const d = screenUV.sub(0.5).length();
    const vig = smoothstep(0.55, 0.95, d).mul(0.28);
    // Darken toward the corners: at centre vig=0 → ×1; at corners vig≈0.28 →
    // ×(1-0.28). (The old <Vignette offset={0.55} darkness={0.28}/>.)
    const outputNode = hueSat.mul(tslMix(float(1.0), float(0.72), vig));

    const renderer = gl as unknown as RenderPipeline["renderer"];
    const pipeline = new RenderPipeline(renderer);
    pipeline.outputNode = outputNode;

    // r3f's render loop calls `gl.render(scene, camera)` each invalidate (and
    // reads the method fresh each frame), so swapping it here routes the
    // FrameCap pump through the node graph. But `pipeline.render()` ITSELF
    // calls `renderer.render(scene, camera)` internally — the very method we're
    // overriding — so a naive swap recurses infinitely. We restore the real
    // render for the duration of the pipeline call, then re-install the
    // override. pipeline.render() is synchronous: the renderer was already
    // awaited via renderer.init() at mount.
    const rendererAny = gl as unknown as {
      render: (scene: THREE.Scene, camera: THREE.Camera) => void;
    };
    const realRender = rendererAny.render.bind(gl);
    const hook = () => {
      rendererAny.render = realRender;
      try {
        pipeline.render();
      } finally {
        rendererAny.render = hook;
      }
    };
    // Patching the renderer's render method is the intended r3f WebGPU
    // integration: gl is GPU state, not an immutable React value, so the
    // immutability rule is a false positive here.
    // eslint-disable-next-line react-hooks/immutability
    rendererAny.render = hook;

    return () => {
      // Restore the raw renderer + free the graph.
      rendererAny.render = realRender;
      pipeline.dispose();
    };
  }, [gl, scene, camera]);

  return null;
}
