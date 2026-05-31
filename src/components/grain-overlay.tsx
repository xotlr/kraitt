"use client";

import { useEffect, useRef } from "react";

/**
 * GrainOverlay — ONE page-wide film-grain layer over everything.
 *
 * The grain used to live inside the scene's fragment shader, so it only
 * textured the WebGL bed inside the island. This overlays the WHOLE page —
 * scene, console chrome, and editorial type — with a single coherent grain
 * layer, the way a film print's grain sits over the entire frame.
 *
 * Why a dedicated WebGL canvas and not a CSS/SVG overlay: CSS `feTurbulence`
 * is Perlin fog, not grain, and any tiling raster gets resampled by the
 * browser when stretched across a large viewport, so it goes soft/blurry.
 * To get razor-fine grain that's genuinely 1:1 with PHYSICAL pixels on a
 * 4K/5K display, the grain has to be generated per-pixel by a shader at full
 * devicePixelRatio. That's what this does.
 *
 * Cost: it is STATIC — one fullscreen triangle, drawn once on mount and on
 * resize. No requestAnimationFrame loop, so after the initial paint it costs
 * nothing per frame. (Static grain also sidesteps the temporal flicker that
 * fine animated grain always suffers.)
 *
 * Blend: the canvas element is set to `mix-blend-mode: soft-light`. The
 * shader outputs grain as small deviations around mid-grey 0.5; under
 * soft-light a flat 0.5 is a no-op, so untouched pixels pass through and only
 * the grain's light/dark deviations dust the page.
 */

const VERT = `#version 300 es
in vec2 a_pos;
void main() {
  // One oversized triangle covering the clip volume — no vertex buffer math
  // needed beyond the three positions fed in.
  gl_Position = vec4(a_pos, 0.0, 1.0);
}`;

const FRAG = `#version 300 es
precision highp float;
out vec4 outColor;

uniform float u_grainPx;   // device px per grain cell
uniform float u_amount;    // grain amplitude

// Dave Hoskins hash13 (https://www.shadertoy.com/view/4djSRW): vec3 -> [0,1).
float hash13(vec3 p3) {
  p3 = fract(p3 * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}

// uniform(0,1) -> ~Gaussian, rational inverse-erf (haasn / mpv filmgrain).
// Real silver-halide grain is bell-distributed, not flat — this is what keeps
// it from reading as digital static.
float gaussian(float u) {
  const float a0 = 0.151015505647689;
  const float a1 = -0.5303572634357367;
  const float a2 = 1.365020122861334;
  const float b0 = 0.132089632343748;
  const float b1 = -0.7607324991323768;
  float p = 0.95 * u + 0.025;
  float q = p - 0.5;
  float r = q * q;
  return (q * (a2 + (a1 * r + a0) / (r * r + b1 * r + b0))) * 0.255121822830526;
}

void main() {
  // gl_FragCoord is in real framebuffer pixels. We render the canvas at full
  // devicePixelRatio (see component), so one framebuffer pixel IS one physical
  // pixel — the grain is as fine as the display allows. u_grainPx gives each
  // grain a hair of spatial extent so it isn't sub-pixel fragile.
  vec2 cell = floor(gl_FragCoord.xy / u_grainPx);
  float g = gaussian(hash13(vec3(cell, 0.0)));   // fixed field, static

  // ADDITIVE on black. The old in-scene grain looked best because it ADDED
  // light onto the near-black bed (col += grain), so the grain read as crisp
  // bright specks on black. soft-light is near-identity on dark pixels, which
  // is why the overlay looked weak over the dark island. So we emit grain as
  // positive-only luminance on a TRANSPARENT canvas and blend with screen
  // (mix-blend-screen on the element): screen over black = pure add (crisp
  // grain on the island), and over bright text/gutter it compresses gently so
  // it never blows the type out. abs() turns the Gaussian's two-sided
  // deviation into light grains (grain on black can only lighten; there is
  // nothing darker than black to go to).
  float lum = abs(g) * u_amount;
  // Premultiplied: rgb already multiplied by alpha. With screen blend the
  // backdrop sees lum added on black.
  outColor = vec4(vec3(lum), lum);
}`;

function compile(gl: WebGL2RenderingContext, type: number, src: string) {
  const sh = gl.createShader(type)!;
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    // Surface shader errors in dev rather than failing silently.
    console.error(gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function GrainOverlay({
  grainPx = 1.0,
  amount = 0.18,
  position = "fixed",
}: {
  /** Device px per grain cell. 1.0 = finest (1 physical px). */
  grainPx?: number;
  /** Grain brightness. The overlay is additive (screen blend), like the old
   *  in-scene grain that added light onto the black bed — so this is how
   *  bright the grain specks get on the dark island. Screen compresses it
   *  over bright areas, so it can ride fairly high without hurting text. */
  amount?: number;
  /** "fixed" = full-page layer (default). "absolute" = fills a positioned
   *  parent, e.g. a second grain pass scoped to the content island. */
  position?: "fixed" | "absolute";
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      // Shader emits premultiplied alpha (rgb already * a) for the screen blend.
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
    });
    if (!gl) return; // No WebGL2 → simply no grain. Page is fine without it.

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram()!;
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return;
    }
    gl.useProgram(prog);

    // Fullscreen triangle.
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW
    );
    const loc = gl.getAttribLocation(prog, "a_pos");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uGrainPx = gl.getUniformLocation(prog, "u_grainPx");
    const uAmount = gl.getUniformLocation(prog, "u_amount");
    gl.uniform1f(uAmount, amount);

    // Render at TRUE device resolution (no DPR cap) so the grain is physical-
    // pixel fine. Cap at the real ratio; clamp to a sane ceiling so a 5x phone
    // doesn't allocate an enormous buffer for a static draw. Size from the
    // canvas's OWN client box (not window), so this works whether it's the
    // fixed full-page layer or an absolute layer filling the island.
    const draw = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }
      gl.viewport(0, 0, w, h);
      // Grain cell measured in the canvas's own device pixels.
      gl.uniform1f(uGrainPx, grainPx);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    // The field is static, so we only redraw when the canvas's box changes.
    // ResizeObserver catches both window resizes AND parent reflows (the
    // island changing size without a window event).
    let raf = 0;
    const schedule = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(draw);
    };
    const ro = new ResizeObserver(schedule);
    ro.observe(canvas);
    draw();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const ext = gl.getExtension("WEBGL_lose_context");
      ext?.loseContext();
    };
  }, [grainPx, amount]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={`pointer-events-none ${
        position === "fixed" ? "fixed z-[60]" : "absolute z-[6]"
      } inset-0 h-full w-full mix-blend-screen`}
    />
  );
}
