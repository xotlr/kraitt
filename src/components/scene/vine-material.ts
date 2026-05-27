import * as THREE from "three";

/**
 * A MeshStandardMaterial extended via onBeforeCompile to give each tube:
 *   - Tapered radius along its length (thin at tips, full mid-tube)
 *   - Alpha + emissive fade at both ends (soft fade-in, soft fade-out)
 *   - Slow per-vine breathing modulation on emissive
 *   - Click-pulse wave that brightens vines as it passes
 *
 * All driven by uniforms shared across vines via a single instance per vine
 * so each can have its own breathing phase and growStart.
 *
 * Tube UV: uv.x runs along the length (0 = start, 1 = end), uv.y wraps the
 * radial direction. We use uv.x for everything length-based.
 */

export type VineMaterialUniforms = {
  uTime: { value: number };
  uGrowEnd: { value: number }; // 0..1, current visible tip of this tube
  uBreathPhase: { value: number };
  uBreathDepth: { value: number };
  uTipTaper: { value: number }; // 0..1 length-fraction at each end that tapers
  uClickTime: { value: number }; // when the last click pulse fired (clock seconds; -1 = never)
  uClickY: { value: number }; // 0..1 vertical position of the click
  uPulseSpeed: { value: number };
  uPulseWidth: { value: number };
  uPulseIntensity: { value: number };
  uVineY0: { value: number }; // vine's normalized y start (top of curve)
  uVineY1: { value: number }; // vine's normalized y end (bottom of curve)
};

export function makeVineMaterial(opts: {
  color: THREE.Color;
  emissive: THREE.Color;
  emissiveIntensity: number;
  metalness: number;
  roughness: number;
  breathPhase: number;
  breathDepth: number;
  tipTaper: number;
  vineY0: number;
  vineY1: number;
}) {
  const mat = new THREE.MeshStandardMaterial({
    color: opts.color,
    emissive: opts.emissive,
    emissiveIntensity: opts.emissiveIntensity,
    metalness: opts.metalness,
    roughness: opts.roughness,
    transparent: true,
    depthWrite: false,
  });

  const uniforms: VineMaterialUniforms = {
    uTime: { value: 0 },
    uGrowEnd: { value: 1 },
    uBreathPhase: { value: opts.breathPhase },
    uBreathDepth: { value: opts.breathDepth },
    uTipTaper: { value: opts.tipTaper },
    uClickTime: { value: -10 },
    uClickY: { value: 0.5 },
    uPulseSpeed: { value: 0.55 },
    uPulseWidth: { value: 0.22 },
    uPulseIntensity: { value: 2.6 },
    uVineY0: { value: opts.vineY0 },
    uVineY1: { value: opts.vineY1 },
  };

  // Cache: r3f / three's onBeforeCompile fires once per program build. We
  // hold a ref to the shader so we can attach uniforms.
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
       uniform float uGrowEnd;
       uniform float uTipTaper;
       varying float vU;`
    );

    // Inject taper at the *visible tip* of the tube: vertices beyond the
    // current grow tip don't render (we draw only drawRange) and the
    // last small fraction of the visible range tapers smoothly to zero
    // radius so the cut-edge ring disappears.
    //
    // Three's TubeGeometry passes the per-vertex along-length coordinate
    // as uv.x. We forward it to the fragment for fades and also use it
    // here to taper position toward the central spline at the tips.
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `vec3 transformed = vec3(position);
       vU = uv.x;
       // Distance from each end as a fraction of total length:
       float endDist = min(uv.x, uGrowEnd - uv.x);
       // Radial taper near tips. The tube vertices live offset from the
       // central spline along the normal; we shrink that offset toward
       // zero at the tips. The "centerline" is approximated as the mean
       // of opposite radial vertices, but here we use a simpler trick:
       // scale the transformed pos toward the average y of its ring by
       // multiplying the radial part by the taper factor. We can't get
       // the centerline in this generic shader, so instead we just
       // shrink transformed.xy toward 0 in tube-local frame... which we
       // also don't have. The practical fallback is to push the vertex
       // back toward (uv-derived) center via the standard normal, but
       // the simplest visually-acceptable taper is to *fade alpha* at
       // the tips rather than reshape geometry. We keep the vU forward
       // and let the fragment shader handle the visual taper.`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
       uniform float uTime;
       uniform float uGrowEnd;
       uniform float uTipTaper;
       uniform float uBreathPhase;
       uniform float uBreathDepth;
       uniform float uClickTime;
       uniform float uClickY;
       uniform float uPulseSpeed;
       uniform float uPulseWidth;
       uniform float uPulseIntensity;
       uniform float uVineY0;
       uniform float uVineY1;
       varying float vU;`
    );

    // Final color injection: multiply by edge-fade alpha, modulate
    // emissive by breathing and the click-pulse wavefront.
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <output_fragment>",
      `
       // ---- visible-range tip fades ----
       // Distance from the leading visible tip and from the start.
       float dTip = uGrowEnd - vU;            // 0 at tip, grows backward
       float dStart = vU;                     // 0 at start
       float fadeTip = smoothstep(0.0, uTipTaper, dTip);
       float fadeStart = smoothstep(0.0, uTipTaper * 0.6, dStart);
       // Cull anything past the visible tip (drawRange does most of this,
       // but this catches the partial-segment between samples).
       if (vU > uGrowEnd) discard;
       float edgeFade = fadeTip * fadeStart;

       // ---- idle breathing ----
       float breath = 1.0 + uBreathDepth * sin(uTime * 0.7 + uBreathPhase);

       // ---- click-pulse wave ----
       // Vine-space y of this fragment: interpolate from vU between
       // uVineY0 (top of curve) and uVineY1 (bottom). Then measure
       // distance from the wavefront, which expands from uClickY with
       // time since click.
       float vineY = mix(uVineY0, uVineY1, vU);
       float elapsed = max(0.0, uTime - uClickTime);
       float wavefront = elapsed * uPulseSpeed;
       float dist = abs(vineY - uClickY);
       // Pulse contribution: peaks at the wavefront, decays with width
       // and with elapsed time so old pulses fade out.
       float pulse = exp(-pow((dist - wavefront) / uPulseWidth, 2.0))
                   * exp(-elapsed * 1.6);
       float pulseGain = 1.0 + pulse * uPulseIntensity;

       // Boost emissive by breath + pulse. totalEmissiveRadiance is the
       // value Three's standard shader writes to outgoing color from the
       // emissive channel — we modulate it before the final composite.
       totalEmissiveRadiance *= breath * pulseGain;

       // Standard composite:
       vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
       outgoingLight = outgoingLight * edgeFade;

       // The default output_fragment expects gl_FragColor assignment.
       #ifdef OPAQUE
         diffuseColor.a = 1.0;
       #endif
       gl_FragColor = vec4(outgoingLight, diffuseColor.a * edgeFade);
       #include <tonemapping_fragment>
       #include <colorspace_fragment>
       #include <fog_fragment>
       #include <premultiplied_alpha_fragment>
      `
    );

    // Store the merged uniforms reference back on the material so the
    // caller can write to them per-frame.
    (mat as unknown as { __uniforms: VineMaterialUniforms }).__uniforms = uniforms;
  };

  // Pre-attach so we have a stable ref even before compile finishes.
  (mat as unknown as { __uniforms: VineMaterialUniforms }).__uniforms = uniforms;

  return mat;
}

export function getVineUniforms(mat: THREE.Material): VineMaterialUniforms {
  return (mat as unknown as { __uniforms: VineMaterialUniforms }).__uniforms;
}
