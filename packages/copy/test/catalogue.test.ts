import { describe, expect, it } from "vitest";
import { catalogue, placeholdersIn } from "../src/index.ts";
import { validateOverride } from "../src/validate.ts";

const entries = Object.values(catalogue);

describe("catalogue", () => {
  it("has unique, well-formed keys that match their surface", () => {
    expect(new Set(entries.map((e) => e.key)).size).toBe(entries.length);
    for (const [k, e] of Object.entries(catalogue)) {
      expect(e.key, k).toBe(k);
      expect(k).toMatch(/^(landing|app|email|legal)\.[a-z0-9_.]+$/);
      expect(k.startsWith(`${e.surface}.`), k).toBe(true);
    }
  });
  it("has defaults that pass their own rules", () => {
    for (const e of entries) expect(validateOverride(e, e.default), e.key).toEqual({ ok: true });
  });
  it("lists every placeholder its default uses", () => {
    for (const e of entries) expect([...e.placeholders].sort(), e.key).toEqual(placeholdersIn(e.default));
  });
  it("covers the landing page", () => {
    expect(catalogue["landing.hero.title"].default).toBe("Every day,\none card turns.");
    expect(catalogue["landing.final.title"].default).toBe("Tonight's card is waiting.");
  });
});
