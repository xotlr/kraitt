"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { useScrollViewport } from "@/lib/scroll-context";
import { stringPaths } from "./string-paths";

/**
 * Strings — ambient brand texture. Hair-thin Line2 polylines drifting in
 * the deep background of the scene. No interaction; the strings are
 * atmosphere, not a control surface. Each string has:
 *
 *   - a curvy resting path (see string-paths.ts)
 *   - a continuous low-frequency idle wave traveling along its length
 *
 * The idle wave is computed per-sample per-frame in JS. With ~40 strings
 * and 96 samples each, that's ~3800 vec3 ops per frame — trivial. We do
 * it in JS rather than a shader patch because Line2's vertex shader is
 * non-trivial to extend cleanly and the cost is invisible.
 */

const SAMPLES_PER_STRING = 96;
const STRING_COLOR = new THREE.Color("#d8d2c4");

// Idle wave params
const IDLE_FREQ = 1.2; // spatial frequency along arc length
const IDLE_SPEED = 0.55; // time multiplier — how fast the wave moves
const IDLE_AMP = 0.035; // peak transverse displacement, world units

// Ambient depth bias — pushes all strings further back than their
// authored z. Strings should read as field texture, not foreground.
const Z_BIAS = -0.4;
// Global opacity multiplier — strings recede into atmosphere.
const OPACITY_MULT = 0.5;

type StringRuntime = {
  rest: Float32Array;
  geom: LineGeometry;
  line: Line2;
  arcLen: Float32Array;
  scratch: Float32Array;
  intensity: number;
  growStart: number;
  breathPhase: number;
};

export function Strings() {
  const groupRef = useRef<THREE.Group>(null);
  const { viewport, size } = useThree();
  const totalHeight = viewport.height * 6;
  const viewportRef = useScrollViewport();

  const runtimes = useMemo<StringRuntime[]>(() => {
    return stringPaths.map((path) => {
      const points = path.anchors.map(
        ([x, y, z]) =>
          new THREE.Vector3(
            x * viewport.width * 0.5,
            (y - 0.5) * totalHeight,
            z + Z_BIAS
          )
      );
      const curve = new THREE.CatmullRomCurve3(
        points,
        false,
        "catmullrom",
        0.5
      );
      const sampled = curve.getPoints(SAMPLES_PER_STRING - 1);

      const rest = new Float32Array(sampled.length * 3);
      const arcLen = new Float32Array(sampled.length);
      let cumulative = 0;
      for (let i = 0; i < sampled.length; i++) {
        rest[i * 3] = sampled[i].x;
        rest[i * 3 + 1] = sampled[i].y;
        rest[i * 3 + 2] = sampled[i].z;
        if (i > 0) {
          cumulative += sampled[i].distanceTo(sampled[i - 1]);
        }
        arcLen[i] = cumulative;
      }
      const scratch = new Float32Array(rest);

      const geom = new LineGeometry();
      geom.setPositions(rest);

      const mat = new LineMaterial({
        color: STRING_COLOR,
        linewidth: 1.0,
        worldUnits: false,
        transparent: true,
        opacity: 0,
        depthTest: false,
        depthWrite: false,
      });
      mat.resolution.set(size.width, size.height);

      const line = new Line2(geom, mat);
      line.computeLineDistances();
      line.renderOrder = 1;

      return {
        rest,
        geom,
        line,
        arcLen,
        scratch,
        intensity: path.intensity,
        growStart: path.growStart,
        breathPhase: path.breathPhase,
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, [viewport.width, viewport.height]);

  // Keep LineMaterial resolution synced — critical for crisp linewidth.
  useEffect(() => {
    runtimes.forEach((r) => {
      const mat = r.line.material as LineMaterial;
      mat.resolution.set(size.width, size.height);
    });
  }, [runtimes, size.width, size.height]);

  useEffect(() => {
    return () => {
      runtimes.forEach((r) => {
        r.geom.dispose();
        (r.line.material as LineMaterial).dispose();
      });
    };
  }, [runtimes]);

  const targetProgress = useRef(0);
  const currentProgress = useRef(0);
  const mouseTarget = useRef({ x: 0, y: 0 });
  const mouseSmooth = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Scroll source is the ScrollArea viewport, not window. Window scroll
    // stays at 0 once the page is wrapped in Radix ScrollArea.
    const onScroll = () => {
      const el = viewportRef.current;
      if (!el) return;
      const max = el.scrollHeight - el.clientHeight;
      targetProgress.current = max > 0 ? el.scrollTop / max : 0;
    };
    const onMove = (e: PointerEvent) => {
      mouseTarget.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouseTarget.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };

    // Defer to next tick so the viewport ref has been attached by
    // ScrollArea's render. Without this, the first onScroll() sees null.
    const id = requestAnimationFrame(() => {
      onScroll();
      const el = viewportRef.current;
      if (el) {
        el.addEventListener("scroll", onScroll, { passive: true });
      }
    });
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(id);
      const el = viewportRef.current;
      if (el) el.removeEventListener("scroll", onScroll);
      window.removeEventListener("pointermove", onMove);
    };
  }, [viewportRef]);

  useFrame(({ clock }) => {
    currentProgress.current +=
      (targetProgress.current - currentProgress.current) * 0.08;
    mouseSmooth.current.x +=
      (mouseTarget.current.x - mouseSmooth.current.x) * 0.06;
    mouseSmooth.current.y +=
      (mouseTarget.current.y - mouseSmooth.current.y) * 0.06;

    const t = clock.elapsedTime;
    const p = currentProgress.current;

    for (let i = 0; i < runtimes.length; i++) {
      const r = runtimes[i];

      // Scroll-driven opacity reveal.
      const localGrow = Math.max(0, Math.min(1, (p - r.growStart) / 0.18));
      const targetOpacity =
        r.intensity * (0.35 + 0.65 * localGrow) * OPACITY_MULT;
      const mat = r.line.material as LineMaterial;
      mat.opacity += (targetOpacity - mat.opacity) * 0.12;

      // Idle wave: traveling sine along arc length, phase offset per
      // string so adjacent strings don't move in sync. Tapered at the
      // endpoints so the wave doesn't yank the anchors.
      for (let k = 0; k < SAMPLES_PER_STRING; k++) {
        const u = k / (SAMPLES_PER_STRING - 1);
        const arc = r.arcLen[k];
        const wave = Math.sin(arc * IDLE_FREQ + t * IDLE_SPEED + r.breathPhase);
        const endTaper =
          smoothstep(0, 0.18, u) * smoothstep(0, 0.18, 1 - u);
        const disp = IDLE_AMP * wave * endTaper;
        r.scratch[k * 3] = r.rest[k * 3] + disp;
        r.scratch[k * 3 + 1] = r.rest[k * 3 + 1];
        r.scratch[k * 3 + 2] = r.rest[k * 3 + 2];
      }
      r.geom.setPositions(r.scratch);
    }

    // Pointer parallax — tiny, ambient.
    if (groupRef.current) {
      const targetRx = mouseSmooth.current.y * 0.035;
      const targetRy = mouseSmooth.current.x * 0.05;
      groupRef.current.rotation.x +=
        (targetRx - groupRef.current.rotation.x) * 0.1;
      groupRef.current.rotation.y +=
        (targetRy - groupRef.current.rotation.y) * 0.1;
    }
  });

  useFrame(() => {
    if (!groupRef.current) return;
    const p = currentProgress.current;
    const halfH = totalHeight / 2;
    const viewHalf = viewport.height / 2;
    const startY = -(halfH - viewHalf);
    const endY = halfH - viewHalf;
    groupRef.current.position.y = startY + (endY - startY) * p;
  });

  return (
    <group ref={groupRef}>
      {runtimes.map((r, i) => (
        <primitive key={i} object={r.line} />
      ))}
    </group>
  );
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
