/**
 * Path definitions for the strings. Each string is a vertical thread
 * with a gentle weave, sampled later into a polyline.
 *
 * Coordinate space (kept stable from the previous tube version so the
 * surrounding scene math doesn't shift):
 *  - x in [-2, 2], scaled at runtime by viewport.width * 0.5
 *  - y in [0, 1], 1 = top, 0 = bottom of the vertical band
 *  - z = depth; positive = forward, negative = back
 *
 * Strings are intentionally many and thin. The visual interest comes
 * from density and pluck, not from any single string being dramatic.
 */
export type StringPath = {
  anchors: [number, number, number][];
  /** Visual intensity 0..1 — controls opacity, not glow. */
  intensity: number;
  /** Scroll progress 0..1 before this string starts drawing. */
  growStart: number;
  /** Idle breathing — sub-pixel drift, mostly imperceptible. */
  breathPhase: number;
  breathDepth: number;
};

function weave(
  baseX: number,
  z: number,
  weaveAmp: number,
  phase: number
): [number, number, number][] {
  // More anchor points = smoother resting curves. We also use multiple
  // sine frequencies so the resting shape isn't a single clean sinusoid
  // (which would read as engineered) but a quietly-varying wave —
  // closer to how a slack string actually hangs.
  const ys = [
    1.08, 0.95, 0.82, 0.7, 0.58, 0.46, 0.34, 0.22, 0.1, -0.02, -0.06,
  ];
  return ys.map((y, i) => {
    const t = i / (ys.length - 1);
    // Two superimposed waves: one slow, one half-cycle slower.
    const w =
      Math.sin(t * Math.PI * 2.2 + phase) * 0.7 +
      Math.sin(t * Math.PI * 1.1 + phase * 0.7) * 0.45;
    const x = baseX + w * weaveAmp;
    return [x, y, z];
  });
}

const COUNT_FG = 14;
const COUNT_MID = 14;
const COUNT_BG = 12;

const paths: StringPath[] = [];

// foreground — most opaque, frontmost
for (let i = 0; i < COUNT_FG; i++) {
  const u = i / (COUNT_FG - 1);
  const baseX = -1.85 + u * 3.7;
  const jitter = Math.sin(i * 12.9898) * 0.05;
  const z = 0.32 + Math.sin(i * 0.7) * 0.1;
  paths.push({
    anchors: weave(baseX + jitter, z, 0.15, i * 1.7),
    intensity: 0.65 + (i % 4 === 0 ? 0.15 : 0),
    growStart: (i * 0.011) % 0.08,
    breathPhase: i * 0.83,
    breathDepth: 0.18,
  });
}

// mid
for (let i = 0; i < COUNT_MID; i++) {
  const u = (i + 0.5) / COUNT_MID;
  const baseX = -1.92 + u * 3.84;
  const jitter = Math.sin(i * 78.233) * 0.04;
  const z = -0.05 + Math.cos(i * 0.9) * 0.08;
  paths.push({
    anchors: weave(baseX + jitter, z, 0.115, i * 2.1 + 1.0),
    intensity: 0.42 + (i % 3 === 0 ? 0.08 : 0),
    growStart: (i * 0.014 + 0.05) % 0.12,
    breathPhase: i * 1.27 + 0.5,
    breathDepth: 0.22,
  });
}

// background — barely there, gives depth
for (let i = 0; i < COUNT_BG; i++) {
  const u = (i + 0.3) / COUNT_BG;
  const baseX = -1.98 + u * 3.96;
  const jitter = Math.sin(i * 43.758) * 0.05;
  const z = -0.45 + Math.sin(i * 1.1) * 0.05;
  paths.push({
    anchors: weave(baseX + jitter, z, 0.1, i * 2.7 + 2.3),
    intensity: 0.22 + (i % 5 === 0 ? 0.04 : 0),
    growStart: (i * 0.013 + 0.08) % 0.15,
    breathPhase: i * 1.91 + 1.2,
    breathDepth: 0.28,
  });
}

export const stringPaths: StringPath[] = paths;
