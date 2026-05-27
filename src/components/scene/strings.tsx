"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { stringPaths } from "./string-paths";

/**
 * Ground-plane strings. Each cable lies on the ground (y ≈ 0), running
 * along the X axis with a sinuous slither in Z. World-fixed — these do
 * not move with scroll. The camera (CameraRig in index.tsx) is what
 * flies on scroll; the strings sit still and the perspective opens up
 * as you scroll.
 *
 * Per-frame work: a slow traveling sine displaces each sample's Z on
 * top of its resting slither, so each cable looks alive and breathing.
 * Cheap (~3800 vec3 ops/frame for the whole field).
 */

const SAMPLES_PER_STRING = 80;
const STRING_COLOR = new THREE.Color("#d8d2c4");

// Idle slither animation
const IDLE_FREQ = 0.9; // spatial frequency along the cable length
const IDLE_SPEED = 0.45; // time multiplier
const IDLE_AMP = 0.08; // peak transverse (z) displacement, world units

type StringRuntime = {
  rest: Float32Array;
  geom: LineGeometry;
  line: Line2;
  /** Arc length at each sample, for the traveling-wave math. */
  arcLen: Float32Array;
  scratch: Float32Array;
  intensity: number;
  breathPhase: number;
};

export function Strings() {
  const { size } = useThree();

  const runtimes = useMemo<StringRuntime[]>(() => {
    return stringPaths.map((path) => {
      // Anchors are already in world units — no viewport scaling.
      const points = path.anchors.map(
        ([x, y, z]) => new THREE.Vector3(x, y, z)
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
        opacity: path.intensity,
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
        breathPhase: path.breathPhase,
      };
      // size deps are intentionally omitted: we only need to rebuild
      // when the path structure changes, not on resize.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    });
  }, []);

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

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;

    for (let i = 0; i < runtimes.length; i++) {
      const r = runtimes[i];

      // Idle slither: traveling sine on top of the resting slither
      // shape, displaced in Z (the slither axis). Endpoints tapered
      // so the cable doesn't pump at its ends.
      for (let k = 0; k < SAMPLES_PER_STRING; k++) {
        const u = k / (SAMPLES_PER_STRING - 1);
        const arc = r.arcLen[k];
        const wave = Math.sin(arc * IDLE_FREQ + t * IDLE_SPEED + r.breathPhase);
        const endTaper =
          smoothstep(0, 0.18, u) * smoothstep(0, 0.18, 1 - u);
        const dz = IDLE_AMP * wave * endTaper;
        r.scratch[k * 3] = r.rest[k * 3];
        r.scratch[k * 3 + 1] = r.rest[k * 3 + 1];
        r.scratch[k * 3 + 2] = r.rest[k * 3 + 2] + dz;
      }
      r.geom.setPositions(r.scratch);
    }
  });

  return (
    <group>
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
