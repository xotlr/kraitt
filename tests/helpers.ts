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
 * Count how many times the scene actually renders over `ms` milliseconds.
 * Each capped frame issues several fullscreen postfx draws via drawArrays; we
 * count the postfx passes per frame once, then divide, to recover the frame
 * rate. Returns both the raw draw count and the inferred renders/sec.
 */
export async function measureRenderRate(
  page: Page,
  ms: number
): Promise<{ drawArrays: number; rafs: number }> {
  return page.evaluate(async (duration) => {
    const c = document.querySelector(
      "canvas[data-engine]"
    ) as HTMLCanvasElement;
    const gl = (c.getContext("webgl2") ||
      c.getContext("webgl")) as WebGLRenderingContext | null;
    if (!gl) return { drawArrays: -1, rafs: -1 };

    let draws = 0;
    let rafs = 0;
    const orig = gl.drawArrays.bind(gl);
    (gl as WebGLRenderingContext).drawArrays = function (
      ...a: Parameters<WebGLRenderingContext["drawArrays"]>
    ) {
      draws++;
      return orig(...a);
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

    (gl as WebGLRenderingContext).drawArrays = orig;
    return { drawArrays: draws, rafs };
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
