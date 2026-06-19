import { test, expect } from "@playwright/test";
import { measureRenderRate, waitForScene } from "./helpers";

/**
 * Performance gates (CLAUDE.md §3) as measurements. These fail CI if the scene
 * stops honouring a gate — the bugs these guard against (uncapped 60fps loop,
 * rendering in a hidden tab) are invisible to typecheck and to a human glance.
 *
 * We measure RENDER COUNT, not wall-clock fps, so software (SwiftShader)
 * rendering in CI doesn't skew the result: the FrameCap pump calls invalidate()
 * at a fixed cadence regardless of how fast each frame actually draws.
 */

test.describe("scene performance gates", () => {
  test("desktop scene renders and stays within the frame cap", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await waitForScene(page);
    await page.waitForTimeout(500);

    // measureRenderRate counts FRAME BOUNDARIES (gaps between draw bursts), so
    // it recovers the true cadence regardless of how many passes the WebGPU
    // node pipeline issues per frame — see helpers.ts.
    const { rendersPerSec, draws, rafs } = await measureRenderRate(page, 2000);
    expect(draws).toBeGreaterThan(0); // the scene actually renders

    // NOTE on environment: under headless SwiftShader the browser's own rAF is
    // CPU-bound, and the multi-pass node pipeline makes each frame heavier, so
    // wall-clock fps sits below the 30 target here. This test asserts the cap's
    // UPPER bound (the scene never renders FASTER than ~30fps, which would mean
    // a broken/raised cap) and that it's alive (not frozen). The precise "is it
    // really pinned to 30" check belongs on a GPU runner / the manual
    // MCP-browser measurement (which reads a clean 30fps). The hidden-tab and
    // reduced-motion tests below are the environment-independent strong gates.
    expect(rendersPerSec).toBeGreaterThan(1); // alive, not frozen
    expect(rendersPerSec).toBeLessThanOrEqual(36); // a 60-cap would exceed
    expect(rafs).toBeGreaterThan(8);
  });

  test("hidden tab pauses the render loop", async ({ page }) => {
    await page.goto("/");
    await waitForScene(page);
    await page.waitForTimeout(500);

    // Emulate the tab going to the background. The visibilitychange handler
    // flips FrameCap to fps=null, so the pump stops and no new frames render.
    await page.evaluate(() => {
      Object.defineProperty(document, "hidden", {
        configurable: true,
        get: () => true,
      });
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Give the state change a beat to propagate, then measure.
    await page.waitForTimeout(400);
    const { rendersPerSec } = await measureRenderRate(page, 800);

    // With the pump stopped, the scene should issue essentially no frames.
    // Measuring frames (not raw draws) keeps this independent of the node
    // pipeline's ~22-draws-per-frame; allow one in-flight frame as slack.
    expect(rendersPerSec).toBeLessThanOrEqual(2);
  });

  test("reduced-motion holds a static frame", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await waitForScene(page);
    await page.waitForTimeout(500);

    const { rendersPerSec } = await measureRenderRate(page, 800);
    // reduced-motion → FrameCap fps=null → no pump → static frame. A handful of
    // initial demand-renders may have already flushed before we sample.
    expect(rendersPerSec).toBeLessThanOrEqual(2);
    await ctx.close();
  });
});
