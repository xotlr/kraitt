import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

/**
 * Vitest — pure-logic unit tests, the layer the Playwright suite can't reach
 * cheaply. These cover the deterministic functions (the intensity ramp, the
 * colour helpers) and the i18n dictionary's structural integrity. No DOM, no
 * browser: a plain node environment, so the suite runs in well under a second.
 *
 * Playwright (`bun test`) still owns the integration/perf/a11y gates that need
 * a real WebGL canvas; Vitest (`bun run test:unit`) owns the math.
 */
export default defineConfig({
  resolve: {
    // Mirror tsconfig's @/* path alias so test imports match app imports.
    alias: { "@": resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    // Only the dedicated unit specs — keep Playwright's tests/ dir out so the
    // two runners never collide on the same files.
    include: ["src/**/*.test.ts"],
  },
});
