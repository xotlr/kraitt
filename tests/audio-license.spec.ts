import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

/**
 * Deploy gate for the audio license.
 *
 * The placeholder ambient.mp3 is copyrighted (Clair Obscur OST) and MUST NOT
 * ship — CLAUDE.md's pre-deploy checklist calls this out. This test turns that
 * prose warning into a hard CI gate: it reads public/audio/LICENSE.json and
 * fails while the track is not cleared. To make CI green, replace the track
 * with a PD / properly-licensed / silent file and set "cleared": true with a
 * real source + license in the manifest.
 *
 * This is intentionally a normal test (not skipped) so it BLOCKS until resolved.
 * Set ALLOW_UNLICENSED_AUDIO=1 to bypass locally during development.
 */

// Tests run from the project root, so resolve the manifest from cwd.
const MANIFEST = resolve(process.cwd(), "public/audio/LICENSE.json");

test("audio asset is license-cleared for deploy", async () => {
  test.skip(
    process.env.ALLOW_UNLICENSED_AUDIO === "1",
    "bypassed via ALLOW_UNLICENSED_AUDIO=1 (development only)"
  );

  const raw = await readFile(MANIFEST, "utf8");
  const manifest = JSON.parse(raw) as {
    cleared: boolean;
    source: string;
    license: string;
    attributionRequired?: boolean;
    attributionText?: string | null;
  };

  expect(
    manifest.cleared,
    `public/audio/${"ambient.mp3"} is NOT license-cleared. Current source: ${manifest.source}. ` +
      `Replace it with a public-domain / properly-licensed / silent track and set "cleared": true ` +
      `in public/audio/LICENSE.json. See CLAUDE.md pre-deploy checklist.`
  ).toBe(true);

  // If the cleared license requires attribution, the manifest must carry the
  // text so it can be rendered on the site — a cleared-but-unattributed CC-BY
  // track is still a violation.
  if (manifest.attributionRequired) {
    expect(
      manifest.attributionText,
      "license requires attribution but attributionText is empty"
    ).toBeTruthy();
  }
});
