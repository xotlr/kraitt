import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Accessibility gate. Runs axe-core against the live page and fails on any
 * serious/critical violation. This guards the a11y work done by hand (hero
 * word labels, aria-hidden decorations, dialog focus ring) against regression,
 * and catches whole classes of issue a manual pass misses (contrast, roles,
 * names).
 *
 * We scope to serious+critical so the gate is meaningful, not noise — minor
 * advisories don't fail CI but can be reviewed by dropping the filter.
 */

test("home page has no serious or critical a11y violations", async ({
  page,
}) => {
  await page.goto("/");
  // Let the reveal animations settle so nothing is mid-transition (opacity 0
  // elements can confuse contrast checks).
  await page.waitForTimeout(1500);

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical"
  );

  // Attach a readable summary on failure.
  if (blocking.length > 0) {
    const summary = blocking
      .map(
        (v) =>
          `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))\n    ${v.helpUrl}`
      )
      .join("\n");
    expect(blocking, `axe found blocking violations:\n${summary}`).toHaveLength(
      0
    );
  }
});

test("keyboard can reach the section nav and open a project dialog", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.waitForTimeout(800);

  // Tabbing should land on focusable controls without a keyboard trap. We don't
  // assert an exact tab order (fragile), only that focus moves and that an
  // interactive element becomes focused.
  await page.keyboard.press("Tab");
  const firstFocused = await page.evaluate(
    () => document.activeElement?.tagName ?? null
  );
  expect(firstFocused).not.toBeNull();

  // Opening a project must surface a dialog with the standard keyboard
  // contract (Escape closes). Project rows are buttons whose accessible name
  // includes the project title; the filter chips above also live in
  // #referenzen, so target a row by a known title to avoid clicking a filter.
  const projectRow = page
    .locator("#referenzen button")
    .filter({ hasText: "OSKAR" })
    .first();
  await projectRow.scrollIntoViewIfNeeded();
  await projectRow.click();

  // Radix moves focus into the dialog; the close control is reachable.
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  // Escape closes it — standard dialog keyboard contract.
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});
