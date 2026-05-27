/**
 * Ground-plane string paths. Each string is a horizontal cable lying on
 * the ground (y ≈ 0), running along the X axis, slithering in Z as you
 * move along it. Stacked in rows going into the distance (-Z), so when
 * the camera looks slightly down you see parallel snakes vanishing
 * toward the horizon.
 *
 * Coordinate space (now world-aligned, not viewport-scaled):
 *  - x: world units, anchors span roughly [-X_HALF, +X_HALF]
 *  - y: near 0 with tiny jitter — they sit on the ground
 *  - z: each string is at a fixed z (its row), with slither modulating
 *       per-sample z within the path itself
 *
 * Camera reads:
 *  - Top of page: pos (0, 0.4, 1.2) — close, low, looking down
 *  - Bottom: pos (0, 2.5, 5.0) looking at (0, 0, -2) — high, back, tilted up
 *
 * Stings are world-fixed; only the camera moves on scroll.
 */
export type StringPath = {
  anchors: [number, number, number][];
  /** Visual intensity 0..1 — controls opacity. */
  intensity: number;
  /** Phase offset for idle wave so adjacent strings don't move in sync. */
  breathPhase: number;
};

const X_HALF = 6.0; // each string spans -6..+6 in X
const SAMPLES_PER_PATH = 9; // anchor points; catmull-rom interpolates between

/** Build one slithering horizontal string at given row z and y. */
function ground(
  z: number,
  y: number,
  slitherAmp: number,
  slitherFreq: number,
  phase: number
): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let i = 0; i < SAMPLES_PER_PATH; i++) {
    const t = i / (SAMPLES_PER_PATH - 1);
    const x = -X_HALF + t * (X_HALF * 2);
    // Slither in z — two superimposed sines for organic-looking bends
    // that aren't a clean sinusoid. Slow primary + faster overtone.
    const slither =
      Math.sin(t * Math.PI * slitherFreq + phase) * slitherAmp +
      Math.sin(t * Math.PI * slitherFreq * 2.3 + phase * 1.7) * slitherAmp * 0.35;
    out.push([x, y, z + slither]);
  }
  return out;
}

const paths: StringPath[] = [];

// Strings stacked in rows going into the distance. Front row (z = +0.5)
// sits just behind the camera's initial focal point. Each subsequent
// row is pushed -0.45 deeper. Rows further back are dimmer.
const ROW_COUNT = 26;
const ROW_SPACING = 0.45;
const FRONT_Z = 0.5;

for (let i = 0; i < ROW_COUNT; i++) {
  const rowZ = FRONT_Z - i * ROW_SPACING;
  // Each row has 1-2 strings slightly offset so the field has density
  // without becoming a perfect grid.
  const stringsInRow = i % 3 === 0 ? 2 : 1;
  for (let j = 0; j < stringsInRow; j++) {
    // Slight per-string y jitter so they're not all on the exact same
    // plane — gives a subtle 3D thickness to the ground field.
    const yJitter = (Math.sin(i * 12.9 + j * 7.3) * 0.5 - 0.5 + 1) * 0.04;
    // Slight per-string z offset within the row.
    const zOffset = j === 0 ? 0 : 0.18 * (Math.sin(i * 5.7) > 0 ? 1 : -1);
    const phase = i * 1.7 + j * 2.4;
    // Slither amplitude varies — some strings nearly straight, others
    // bend a lot. Bigger bends in the middle of the field, calmer
    // strings up close and far away.
    const distanceFromMid = Math.abs(i - ROW_COUNT / 2) / (ROW_COUNT / 2);
    const slitherAmp = 0.35 + (1 - distanceFromMid) * 0.45 + (j === 0 ? 0 : 0.1);
    // Frequency: how many "S" curves along the length.
    const slitherFreq = 1.4 + Math.sin(i * 0.7) * 0.6;

    // Intensity falls off with distance from camera so the field has
    // natural depth-cueing on top of perspective shrinkage.
    const depthFade = 1 - (i / ROW_COUNT) * 0.55;

    paths.push({
      anchors: ground(rowZ + zOffset, yJitter, slitherAmp, slitherFreq, phase),
      intensity: 0.55 * depthFade + (j === 0 ? 0 : 0.08),
      breathPhase: phase,
    });
  }
}

export const stringPaths: StringPath[] = paths;
