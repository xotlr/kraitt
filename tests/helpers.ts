import type { Page } from "@playwright/test";

/**
 * Black-box instrumentation helpers. The app ships no test hooks; everything
 * here works by patching browser APIs in-page before the app uses them, so the
 * production bundle stays clean.
 */

// The page has three <canvas> elements: the three.js scene canvas and two
// aria-hidden grain-overlay canvases (page-wide + island-scoped). Everything
// here must instrument the SCENE canvas, which three.js stamps with
// data-engine — the grain canvases carry a 2D context and none of the scene's
// draw calls, so a bare querySelector("canvas") would grab the wrong one.
const SCENE_CANVAS = "canvas[data-engine]";

/** Wait until the scene's <canvas> exists and has a non-zero backing store. */
export async function waitForScene(page: Page): Promise<void> {
  await page.waitForSelector(SCENE_CANVAS, {
    state: "attached",
    timeout: 15_000,
  });
  await page.waitForFunction(
    (sel) => {
      const c = document.querySelector(sel);
      return !!c && (c as HTMLCanvasElement).width > 0 && (c as HTMLCanvasElement).height > 0;
    },
    SCENE_CANVAS,
    { timeout: 15_000 }
  );
}

/**
 * Measure how many times the scene actually renders over `ms` milliseconds.
 *
 * A single capped frame issues MANY GPU draws — under the WebGPU node pipeline
 * (WebGL2 backend in CI) one frame is terrain + atmosphere + the bloom mip
 * chain + chromatic aberration + SMAA + tone/grade passes, ~22 draws split
 * across BOTH drawArrays and drawElements. So we can't infer the frame rate by
 * dividing a draw count by a separately-sampled passes-per-frame (the old
 * method: it under-counted by ignoring drawElements and mismatched sample
 * windows). Instead we timestamp every draw and count FRAME BOUNDARIES — a gap
 * > 12ms between consecutive draws marks a new frame, since the FrameCap pump
 * spaces frames ≥ 33ms (30fps) / 50ms (20fps) apart while the draws within one
 * frame fire back-to-back. That recovers the true render cadence regardless of
 * how many passes each frame contains.
 *
 * Returns the measured renders/sec, raw draw count, and rAF ticks (liveness).
 */
export async function measureRenderRate(
  page: Page,
  ms: number
): Promise<{ rendersPerSec: number; draws: number; rafs: number }> {
  return page.evaluate(async (duration) => {
    const c = document.querySelector(
      "canvas[data-engine]"
    ) as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { rendersPerSec: -1, draws: -1, rafs: -1 };

    let draws = 0;
    let rafs = 0;
    const times: number[] = [];
    const origDA = gl.drawArrays.bind(gl);
    const origDE = gl.drawElements.bind(gl);
    gl.drawArrays = function (
      ...a: Parameters<WebGLRenderingContext["drawArrays"]>
    ) {
      draws++;
      times.push(performance.now());
      return origDA(...a);
    };
    gl.drawElements = function (
      ...a: Parameters<WebGLRenderingContext["drawElements"]>
    ) {
      draws++;
      times.push(performance.now());
      return origDE(...a);
    };

    const t0 = performance.now();
    await new Promise<void>((resolve) => {
      function tick() {
        rafs++;
        if (performance.now() - t0 < duration) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });

    gl.drawArrays = origDA;
    gl.drawElements = origDE;

    // Count frame boundaries: a gap > 12ms between draws starts a new frame.
    let frames = times.length > 0 ? 1 : 0;
    for (let i = 1; i < times.length; i++) {
      if (times[i] - times[i - 1] > 12) frames++;
    }
    const rendersPerSec = frames / (duration / 1000);
    return { rendersPerSec, draws, rafs };
  }, ms);
}

/**
 * Install an AudioContext spy BEFORE the app constructs its context. Records
 * every node→destination connection so a test can assert the mic path never
 * reaches the speakers. Call on a fresh page before any user gesture.
 */
export async function installAudioGraphSpy(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as {
      __audioEdges: { to: "destination" | "node"; from: string }[];
      AudioContext: typeof AudioContext;
      webkitAudioContext?: typeof AudioContext;
    };
    w.__audioEdges = [];

    const Ctx = w.AudioContext || w.webkitAudioContext;
    if (!Ctx) return;

    const origConnect = AudioNode.prototype.connect as AudioNode["connect"];
    // Tag mic/music source nodes so we can label edges by origin.
    const origMic = (Ctx.prototype as AudioContext).createMediaStreamSource;
    const origMusic = (Ctx.prototype as AudioContext).createMediaElementSource;

    (Ctx.prototype as AudioContext).createMediaStreamSource = function (
      this: AudioContext,
      stream: MediaStream
    ) {
      const node = origMic.call(this, stream);
      (node as unknown as { __origin: string }).__origin = "mic";
      return node;
    };
    (Ctx.prototype as AudioContext).createMediaElementSource = function (
      this: AudioContext,
      el: HTMLMediaElement
    ) {
      const node = origMusic.call(this, el);
      (node as unknown as { __origin: string }).__origin = "music";
      return node;
    };

    // @ts-expect-error — replacing the overloaded connect for instrumentation
    AudioNode.prototype.connect = function (this: AudioNode, target, ...rest) {
      const from =
        (this as unknown as { __origin?: string }).__origin ?? "unknown";
      const isDest =
        typeof AudioDestinationNode !== "undefined" &&
        target instanceof AudioDestinationNode;
      w.__audioEdges.push({ to: isDest ? "destination" : "node", from });
      // @ts-expect-error — forward original args
      return origConnect.call(this, target, ...rest);
    };
  });
}

export async function readAudioEdges(
  page: Page
): Promise<{ to: "destination" | "node"; from: string }[]> {
  return page.evaluate(
    () =>
      (window as unknown as { __audioEdges?: { to: "destination" | "node"; from: string }[] })
        .__audioEdges ?? []
  );
}
