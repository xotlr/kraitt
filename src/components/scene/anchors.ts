/**
 * Vine anchor points in normalized scene space.
 *
 * - x in [-2, 2], scaled at runtime by viewport.width * 0.5
 * - y in [0, 1], 1 = top of vine field, 0 = bottom. Mapped at runtime
 *   onto the full vertical span.
 * - z provides depth (positive = forward, negative = back).
 *
 * Each vine threads vertically with a gentle S-curve weave so the field
 * reads as a tapestry of falling threads, not as parallel stripes.
 */
export type VineDef = {
  anchors: [number, number, number][];
  radius: number;
  glow: number;
  growStart: number;
  // Per-vine breathing phase (radians) and depth (0..1 fraction of emissive).
  breathPhase: number;
  breathDepth: number;
};

// Helper to generate a weave: small horizontal oscillation around a base x.
function thread(
  baseX: number,
  z: number,
  weaveAmp: number,
  phase: number
): [number, number, number][] {
  const ys = [1.05, 0.86, 0.68, 0.5, 0.32, 0.14, -0.02];
  return ys.map((y, i) => {
    const t = i / (ys.length - 1);
    const x = baseX + Math.sin(t * Math.PI * 2 + phase) * weaveAmp;
    return [x, y, z];
  });
}

const COUNT_FG = 14;
const COUNT_MID = 14;
const COUNT_BG = 12;

const vines: VineDef[] = [];

// ----- foreground -----
for (let i = 0; i < COUNT_FG; i++) {
  const u = i / (COUNT_FG - 1);
  const baseX = -1.85 + u * 3.7;
  // tiny jitter so spacing isn't a perfect grid
  const jitter = Math.sin(i * 12.9898) * 0.05;
  const z = 0.32 + Math.sin(i * 0.7) * 0.1;
  vines.push({
    anchors: thread(baseX + jitter, z, 0.06, i * 1.7),
    radius: 0.0028 + (i % 3 === 0 ? 0.0008 : 0),
    glow: 1.1 + (i % 4 === 0 ? 0.25 : 0),
    growStart: (i * 0.011) % 0.08,
    breathPhase: i * 0.83,
    breathDepth: 0.18,
  });
}

// ----- mid layer (slightly back, weave a bit different phase) -----
for (let i = 0; i < COUNT_MID; i++) {
  const u = (i + 0.5) / COUNT_MID;
  const baseX = -1.92 + u * 3.84;
  const jitter = Math.sin(i * 78.233) * 0.04;
  const z = -0.05 + Math.cos(i * 0.9) * 0.08;
  vines.push({
    anchors: thread(baseX + jitter, z, 0.045, i * 2.1 + 1.0),
    radius: 0.002 + (i % 5 === 0 ? 0.0004 : 0),
    glow: 0.7 + (i % 3 === 0 ? 0.1 : 0),
    growStart: (i * 0.014 + 0.05) % 0.12,
    breathPhase: i * 1.27 + 0.5,
    breathDepth: 0.22,
  });
}

// ----- background -----
for (let i = 0; i < COUNT_BG; i++) {
  const u = (i + 0.3) / COUNT_BG;
  const baseX = -1.98 + u * 3.96;
  const jitter = Math.sin(i * 43.758) * 0.05;
  const z = -0.45 + Math.sin(i * 1.1) * 0.05;
  vines.push({
    anchors: thread(baseX + jitter, z, 0.04, i * 2.7 + 2.3),
    radius: 0.0015 + (i % 4 === 0 ? 0.0003 : 0),
    glow: 0.32 + (i % 5 === 0 ? 0.06 : 0),
    growStart: (i * 0.013 + 0.08) % 0.15,
    breathPhase: i * 1.91 + 1.2,
    breathDepth: 0.28,
  });
}

export const vineDefs: VineDef[] = vines;
