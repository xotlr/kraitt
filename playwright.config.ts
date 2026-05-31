import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config — the enforcement layer for the CLAUDE.md performance
 * gates and the visual/a11y baselines. These tests turn the gate comments
 * ("30fps cap", "tab-hidden pauses", "mic never reaches destination") into
 * measurements that fail CI on regression.
 *
 * WebGL needs a real GPU path. Chromium gets SwiftShader software rendering
 * via the flags below, which is enough to render the scene headlessly in CI;
 * the perf-gate tests measure RENDER COUNT (invalidate cadence), not wall-clock
 * fps, so software rendering doesn't skew the assertions.
 */
const PORT = 3100;

export default defineConfig({
  testDir: "./tests",
  // Visual baselines are platform-sensitive; keep them tolerant and store
  // snapshots next to the tests.
  snapshotPathTemplate: "{testDir}/__screenshots__/{testFilePath}/{arg}{ext}",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",
  timeout: 30_000,
  expect: { timeout: 10_000, toHaveScreenshot: { maxDiffPixelRatio: 0.02 } },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: [
            // Force a working WebGL path under headless software rendering.
            "--use-gl=angle",
            "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist",
            // Headless getUserMedia: hand the page a synthetic mic so the
            // audio-graph test can exercise the mic path without a real device
            // or a permission prompt.
            "--use-fake-device-for-media-stream",
            "--use-fake-ui-for-media-stream",
            "--autoplay-policy=no-user-gesture-required",
          ],
        },
      },
    },
  ],

  // Build once and serve the production bundle — tests should measure what
  // ships, not the dev server with HMR overhead.
  webServer: {
    command: `bun run build && bun run start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
