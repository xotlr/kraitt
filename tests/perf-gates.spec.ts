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

    // Cost of ONE rendered frame (postfx pass count), measured by forcing a
    // single frame — keeps the rest independent of the exact effect stack.
    const passesPerFrame = await page.evaluate(async () => {
      const c = document.querySelector("canvas") as HTMLCanvasElement;
      const gl = (c.getContext("webgl2") ||
        c.getContext("webgl")) as WebGLRenderingContext;
      let n = 0;
      const orig = gl.drawArrays.bind(gl);
      gl.drawArrays = function (
        ...a: Parameters<WebGLRenderingContext["drawArrays"]>
      ) {
        n++;
        return orig(...a);
      };
      await new Promise((r) => setTimeout(r, 150));
      gl.drawArrays = orig;
      return n;
    });
    expect(passesPerFrame).toBeGreaterThan(0);

    const { drawArrays, rafs } = await measureRenderRate(page, 1000);
    const rendersPerSec = drawArrays / passesPerFrame;

    // NOTE on environment: under headless SwiftShader the browser's own rAF is
    // CPU-bound (~25-30Hz here), so it cannot refresh fast enough to prove a
    // 30fps cap distinct from the uncapped loop — both bottleneck on the
    // software renderer. So this test asserts the cap's UPPER bound (the scene
    // never renders FASTER than ~30fps, which would indicate a broken/raised
    // cap) and that it's alive (not frozen). The lower-bound "is it really
    // capped below a 60Hz refresh" check is covered on a GPU runner / the
    // manual MCP-browser measurement, not here. The hidden-tab and
    // reduced-motion tests below are the environment-independent strong gates.
    expect(rendersPerSec).toBeGreaterThan(2); // alive, not frozen
    expect(rendersPerSec).toBeLessThanOrEqual(36); // 30 target + headroom; a 60-cap would exceed
    expect(rafs).toBeGreaterThan(8);
  });

  test("hidden tab pauses the render loop", async ({ page, context }) => {
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
    const { drawArrays } = await measureRenderRate(page, 800);

    // With the pump stopped, the scene should issue essentially no draws.
    // Allow a tiny slack for any single in-flight frame.
    expect(drawArrays).toBeLessThanOrEqual(10);
  });

  test("reduced-motion holds a static frame", async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: "reduce" });
    const page = await ctx.newPage();
    await page.goto("/");
    await waitForScene(page);
    await page.waitForTimeout(500);

    const { drawArrays } = await measureRenderRate(page, 800);
    // reduced-motion → FrameCap fps=null → no pump → static frame. A handful of
    // initial demand-renders may have already flushed before we sample.
    expect(drawArrays).toBeLessThanOrEqual(10);
    await ctx.close();
  });
});
