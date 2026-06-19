// Ashima 3D simplex noise, ported to TSL (three's node system) so it runs on
// the WebGPU renderer. Shared by the terrain vertex shader and the atmosphere
// fragment shader — both files used to carry their own identical GLSL copy;
// this is the one source of truth.
//
// The fbm() built on top differs per file (terrain stacks 4 octaves over a
// time axis; atmosphere stacks 2 over a domain-warped position), so fbm stays
// local to each shader — only the noise primitive is shared here.
//
// `snoise3` is a TSL Fn: call it with a vec3 node, it returns a float node.
// The body is a node-for-node transcription of the canonical Ashima GLSL
// (mod289 / permute / taylorInvSqrt / snoise) — same constants, same shape, so
// the field is identical to the WebGL version the scene was tuned against.
//
// Ref: Ashima Arts / Stefan Gustavson, "webgl-noise" (MIT).
import {
  abs,
  dot,
  float,
  floor,
  Fn,
  max,
  mul,
  step,
  sub,
  vec3,
  vec4,
} from "three/tsl";
import type { Node } from "three/webgpu";

// @types/three types `step` as (FloatOrNumber, FloatOrNumber) => Node<"float">
// — it has no componentwise/vector overload, though the runtime supports one.
// This wrapper applies the GLSL semantics step(edge, x) == (x >= edge) ? 1 : 0
// componentwise and keeps the caller's vector type. (A defs gap, not a logic
// one — the field is identical to the WebGL build.)
function vstep<T extends Node<"vec3"> | Node<"vec4">>(edge: T, x: T): T {
  return (step as unknown as (e: T, v: T) => T)(edge, x);
}

const mod289v3 = Fn(([x]: [Node<"vec3">]) =>
  x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
);
const mod289v4 = Fn(([x]: [Node<"vec4">]) =>
  x.sub(floor(x.mul(1.0 / 289.0)).mul(289.0))
);
const permute = Fn(([x]: [Node<"vec4">]) =>
  mod289v4(x.mul(34.0).add(1.0).mul(x))
);
const taylorInvSqrt = Fn(([r]: [Node<"vec4">]) =>
  float(1.79284291400159).sub(r.mul(0.85373472095314))
);

export const snoise3 = /*#__PURE__*/ Fn(([v]: [Node<"vec3">]) => {
  const C = vec3(1.0 / 6.0, 1.0 / 3.0, 0.0);
  const D = vec4(0.0, 0.5, 1.0, 2.0);

  const i = floor(v.add(dot(v, C.yyy))).toVar();
  const x0 = v.sub(i).add(dot(i, C.xxx)).toVar();

  // step(edge, x) == x.step(edge); method forms preserve the vec3 type (the
  // standalone step()/sub()/min()/max() select a float overload off the scalar
  // and lose the vector-ness, which breaks the swizzles below).
  const g = vstep(x0.yzx, x0.xyz).toVar();
  const l = g.oneMinus().toVar();
  const i1 = g.xyz.min(l.zxy);
  const i2 = g.xyz.max(l.zxy);

  const x1 = x0.sub(i1).add(C.xxx);
  const x2 = x0.sub(i2).add(C.yyy);
  const x3 = x0.sub(D.yyy);

  i.assign(mod289v3(i));
  const p = permute(
    permute(
      permute(i.z.add(vec4(0.0, i1.z, i2.z, 1.0)))
        .add(i.y)
        .add(vec4(0.0, i1.y, i2.y, 1.0))
    )
      .add(i.x)
      .add(vec4(0.0, i1.x, i2.x, 1.0))
  ).toVar();

  const n_ = float(0.142857142857);
  const ns = mul(n_, D.wyz).sub(D.xzx);

  const j = p.sub(mul(49.0, floor(p.mul(ns.z).mul(ns.z)))).toVar();
  const x_ = floor(j.mul(ns.z));
  const y_ = floor(j.sub(mul(7.0, x_)));

  const x = x_.mul(ns.x).add(ns.yyyy).toVar();
  const y = y_.mul(ns.x).add(ns.yyyy).toVar();
  const h = abs(x).oneMinus().sub(abs(y));

  const b0 = vec4(x.xy, y.xy);
  const b1 = vec4(x.zw, y.zw);
  const s0 = floor(b0).mul(2.0).add(1.0);
  const s1 = floor(b1).mul(2.0).add(1.0);
  const sh = vstep(h, vec4(0.0)).negate();

  const a0 = b0.xzyw.add(s0.xzyw.mul(sh.xxyy));
  const a1 = b1.xzyw.add(s1.xzyw.mul(sh.zzww));

  const p0 = vec3(a0.xy, h.x).toVar();
  const p1 = vec3(a0.zw, h.y).toVar();
  const p2 = vec3(a1.xy, h.z).toVar();
  const p3 = vec3(a1.zw, h.w).toVar();

  const norm = taylorInvSqrt(
    vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3))
  );
  p0.mulAssign(norm.x);
  p1.mulAssign(norm.y);
  p2.mulAssign(norm.z);
  p3.mulAssign(norm.w);

  const m = max(
    sub(0.6, vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3))),
    0.0
  ).toVar();
  m.assign(m.mul(m));
  return mul(
    42.0,
    dot(
      m.mul(m),
      vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3))
    )
  );
});
