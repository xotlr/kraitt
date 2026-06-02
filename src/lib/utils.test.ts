import { describe, it, expect } from "vitest";
import {
  INTENSITY_RAMP,
  sampleRamp,
  rgbString,
  intensityColor,
} from "./utils";

/**
 * The intensity ramp is the desk's shared "how loud" palette — the fader fill,
 * the EQ, and the lit buttons all sample it, so an off-by-one in the segment
 * math would desync every meter at once. These lock the contract: clamping,
 * exact endpoints, linear interpolation, and stringify rounding.
 */

describe("sampleRamp", () => {
  it("returns the first stop at t=0", () => {
    expect(sampleRamp(0)).toEqual([0x52, 0x61, 0x7f]);
  });

  it("returns the last stop at t=1", () => {
    expect(sampleRamp(1)).toEqual([0xc2, 0xa5, 0x78]);
  });

  it("clamps t below 0 to the first stop", () => {
    expect(sampleRamp(-5)).toEqual(sampleRamp(0));
  });

  it("clamps t above 1 to the last stop", () => {
    expect(sampleRamp(99)).toEqual(sampleRamp(1));
  });

  it("hits an interior stop exactly at its fractional position", () => {
    // 4 stops → boundaries at 0, 1/3, 2/3, 1. t=1/3 must land on stop[1]
    // with no interpolation bleed from the neighbours.
    const [r, g, b] = sampleRamp(1 / 3);
    expect(r).toBeCloseTo(0x6f, 5);
    expect(g).toBeCloseTo(0x6f, 5);
    expect(b).toBeCloseTo(0x96, 5);
  });

  it("linearly interpolates at a segment midpoint", () => {
    // Halfway between stop[0] (#52617f) and stop[1] (#6f6f96) is at t = 1/6.
    const a = INTENSITY_RAMP[0];
    const b = INTENSITY_RAMP[1];
    const [r, g, bl] = sampleRamp(1 / 6);
    expect(r).toBeCloseTo((a[0] + b[0]) / 2, 5);
    expect(g).toBeCloseTo((a[1] + b[1]) / 2, 5);
    expect(bl).toBeCloseTo((a[2] + b[2]) / 2, 5);
  });

  it("is monotonic where the ramp's channel is monotonic (R rises to the gold peak)", () => {
    // R climbs 0x52 → 0x6f → 0xaa → 0xc2 across the whole ramp.
    const r0 = sampleRamp(0)[0];
    const rMid = sampleRamp(0.5)[0];
    const r1 = sampleRamp(1)[0];
    expect(rMid).toBeGreaterThan(r0);
    expect(r1).toBeGreaterThan(rMid);
  });

  it("accepts a custom ramp", () => {
    const ramp: [number, number, number][] = [
      [0, 0, 0],
      [100, 200, 50],
    ];
    expect(sampleRamp(0.5, ramp)).toEqual([50, 100, 25]);
  });

  it("returns un-rounded channels (interpolation is float)", () => {
    // Pick a t whose interpolation yields a non-integer to prove no rounding
    // happens at the sampler layer (rounding lives in rgbString).
    const [r] = sampleRamp(0.1);
    expect(Number.isInteger(r)).toBe(false);
  });
});

describe("rgbString", () => {
  it("rounds channels and formats as rgb()", () => {
    expect(rgbString([10.4, 20.6, 30.5])).toBe("rgb(10, 21, 31)");
  });

  it("round-trips a ramp endpoint", () => {
    expect(rgbString(INTENSITY_RAMP[0])).toBe("rgb(82, 97, 127)");
  });
});

describe("intensityColor", () => {
  it("composes sampleRamp + rgbString", () => {
    expect(intensityColor(0)).toBe(rgbString(sampleRamp(0)));
    expect(intensityColor(1)).toBe(rgbString(sampleRamp(1)));
  });

  it("returns a valid rgb() string for any t", () => {
    for (const t of [-1, 0, 0.27, 0.5, 0.83, 1, 2]) {
      expect(intensityColor(t)).toMatch(/^rgb\(\d{1,3}, \d{1,3}, \d{1,3}\)$/);
    }
  });
});
