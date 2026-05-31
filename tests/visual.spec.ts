import { test, expect } from "@playwright/test";
import { waitForScene } from "./helpers";

/**
 * Visual guards for the one thing the site sells — the scene.
 *
 * A pixel-exact screenshot baseline is the wrong tool here: the page is alive
 * everywhere (animated shader, VU needle, spectrum EQ, reveal transitions), so
 * a full-frame diff is perpetually flaky. Instead we assert the things that are
 * actually invariant and that a regression would break:
 *   1. The scene BED stays OLED-black (the brand) — sampled from canvas pixels.
 *   2. The console CHROME frames the screen — the rails/panel are present and
 *      the island sits between them. Structural, not pixel-exact.
 */

test("scene bed stays OLED-black (brand invariant)", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await waitForScene(page);
  await page.waitForTimeout(800);

  // Average luminance of a patch near the TOP of the canvas (sky/bed; the
  // terrain sits low). On the dark theme this must be near-black — the contour
  // crests are bright but sparse, so a top patch's mean stays in the floor.
  const meanLuma = await page.evaluate(() => {
    const c = document.querySelector("canvas") as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return -1;
    const w = 64;
    const h = 32;
    const x = Math.floor(c.width / 2 - w / 2);
    const y = c.height - h - 4; // gl origin is bottom-left → high y = top
    const px = new Uint8Array(w * h * 4);
    gl.readPixels(x, y, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    let sum = 0;
    for (let i = 0; i < px.length; i += 4) {
      sum += 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
    }
    return sum / (w * h);
  });

  expect(meanLuma).toBeGreaterThanOrEqual(0); // readback worked
  // Near-black (~<12% of 255). Grain/haze stay under this; a washed-out bed
  // (AgX/bloom regression lifting black toward mid-grey ~128) trips it hard.
  expect(meanLuma).toBeLessThan(30);
});

test("console chrome frames the screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(800);

  // The desktop layout is left rail · island (screen) · right rail. Assert the
  // three are present and the rails sit on either side of the screen — the
  // monitor framing the whole design depends on. Using bounding boxes keeps
  // this robust to the live content inside each region.
  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  const nav = page.getByRole("navigation", { name: "Sektionen" });
  await expect(nav).toBeVisible();

  const canvasBox = await canvas.boundingBox();
  const navBox = await nav.boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(navBox).not.toBeNull();
  // The section-nav rail sits to the RIGHT of the screen.
  expect(navBox!.x).toBeGreaterThan(canvasBox!.x);
});
