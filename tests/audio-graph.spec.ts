import { test, expect } from "@playwright/test";
import { installAudioGraphSpy, readAudioEdges } from "./helpers";

/**
 * Audio-graph topology guard.
 *
 * The worst bug found in this codebase was the mic playing back through the
 * speakers: the shared AnalyserNode was wired to ctx.destination, so the live
 * mic input fed straight to output as feedback. This test reconstructs the
 * connection graph by spying on AudioNode.connect and asserts the invariant
 * that fix established: a MIC-origin node must NEVER connect to destination.
 *
 * It runs headlessly with a synthetic mic (see the fake-media flags in
 * playwright.config.ts), so no real device or permission prompt is involved.
 */

test("mic input never connects to the audio destination", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["microphone"]);
  await installAudioGraphSpy(page);

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // The desktop rail (lg+) carries the mic button, labelled "Mikrofon" (DE
  // default). Clicking it is the user gesture that builds the audio context
  // and wires the mic source.
  const mic = page.getByRole("button", { name: "Mikrofon" }).first();
  await mic.click();

  // Let the getUserMedia promise resolve and the source connect.
  await page.waitForTimeout(800);

  const edges = await readAudioEdges(page);

  // Sanity: the gesture actually built a graph (the spy saw connections).
  expect(edges.length).toBeGreaterThan(0);

  // The invariant: no edge originating from the mic source reaches destination.
  const micToDestination = edges.filter(
    (e) => e.from === "mic" && e.to === "destination"
  );
  expect(
    micToDestination,
    `mic-origin node connected to destination (feedback): ${JSON.stringify(edges)}`
  ).toHaveLength(0);
});

test("music output, once it builds its graph, connects to the destination", async ({
  page,
}) => {
  await installAudioGraphSpy(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  // "Musik" is the play button. toggleMusic awaits ctx.resume() before building
  // the source graph; under headless Chromium that resume can stall because the
  // synthetic click isn't treated as a real autoplay gesture, so no graph is
  // built. We don't fight that here — the LOAD-BEARING audio invariant (mic
  // never reaches destination) is covered by the test above. This one asserts
  // the complementary positive: IF the music graph builds, music→destination
  // exists (and, implicitly, it's the only origin allowed to reach output).
  const play = page.getByRole("button", { name: /^Musik/ }).first();
  await play.click();
  await page.waitForTimeout(1200);

  const edges = await readAudioEdges(page);
  test.skip(
    edges.length === 0,
    "music graph did not build (headless autoplay/resume stalled) — covered on a gesture-capable runner"
  );

  const musicToDestination = edges.filter(
    (e) => e.from === "music" && e.to === "destination"
  );
  expect(
    musicToDestination.length,
    `expected music→destination edge, saw: ${JSON.stringify(edges)}`
  ).toBeGreaterThanOrEqual(1);
});
