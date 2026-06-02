import { describe, it, expect } from "vitest";
import { DICT, dict } from "./i18n";
import { projects } from "@/data/projects";

/**
 * i18n integrity. The DE and EN dictionaries are hand-maintained parallel
 * objects; the failure mode is adding a key to one language and forgetting the
 * other, which surfaces as `undefined` rendered in the UI — invisible to
 * typecheck (both satisfy `Dict`, but a key can still be present-and-correct in
 * one and a stale leftover or a typo'd sibling in the other) and only caught by
 * eyeballing the running site in both languages. This turns that into a test.
 *
 * The structural check walks both trees in parallel and asserts identical key
 * SETS at every object level, treating arrays and functions as leaves (their
 * contents are content, not structure). The projects check ties the dictionary
 * back to the language-invariant data: every project that ships must have copy.
 */

/** Recursively collect the set of object-key paths, arrays/functions as leaves. */
function keyShape(value: unknown, prefix = ""): string[] {
  if (
    value === null ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return [];
  }
  const out: string[] = [];
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    out.push(path);
    out.push(...keyShape(v, path));
  }
  return out.sort();
}

describe("i18n dictionary parity", () => {
  it("DE and EN expose the same key structure", () => {
    const de = keyShape(DICT.de);
    const en = keyShape(DICT.en);

    const missingInEn = de.filter((k) => !en.includes(k));
    const missingInDe = en.filter((k) => !de.includes(k));

    expect(missingInEn, "keys present in DE but missing in EN").toEqual([]);
    expect(missingInDe, "keys present in EN but missing in DE").toEqual([]);
  });

  it("every shipped project id has copy in BOTH languages", () => {
    for (const lang of ["de", "en"] as const) {
      const d = dict(lang);
      for (const p of projects) {
        expect(
          d.referenzen.projects[p.id],
          `project "${p.id}" has no ${lang.toUpperCase()} copy in i18n.referenzen.projects`
        ).toBeTruthy();
      }
    }
  });

  it("referenzen project copy has the same fields in both languages", () => {
    const de = dict("de").referenzen.projects;
    const en = dict("en").referenzen.projects;
    expect(Object.keys(de).sort()).toEqual(Object.keys(en).sort());
    for (const id of Object.keys(de)) {
      expect(keyShape(de[id]), `field shape for project "${id}"`).toEqual(
        keyShape(en[id])
      );
    }
  });

  it("the language getter returns the matching dictionary", () => {
    expect(dict("de")).toBe(DICT.de);
    expect(dict("en")).toBe(DICT.en);
  });
});
