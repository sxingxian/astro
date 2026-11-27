import { describe, expect, it } from "vitest";
import { catalogue } from "../src/index.ts";
import { parseDoc, safeHref } from "../src/doc.ts";
import { validateOverride } from "../src/validate.ts";

const doc = (blocks: unknown[]) => JSON.stringify({ v: 1, blocks });

describe("parseDoc", () => {
  it("accepts the allowed blocks and marks", () => {
    expect(
      parseDoc(doc([{ t: "h2", c: [{ t: "text", text: "Hi", b: true }] }, { t: "ul", items: [[{ t: "text", text: "a", href: "mailto:x@y.z" }]] }, { t: "divider" }, { t: "callout", c: [{ t: "text", text: "Note", i: true }] }])).ok
    ).toBe(true);
  });
  it("refuses unsafe links", () => {
    for (const href of ["javascript:alert(1)", "data:text/html,x", "//evil", "ftp://x", "https://exa mple.com"])
      expect(parseDoc(doc([{ t: "p", c: [{ t: "text", text: "x", href }] }])), href).toEqual({ ok: false, reason: "doc_invalid" });
  });
  it("refuses unknown blocks, extra keys, HTML-ish fields and bad JSON", () => {
    for (const j of ['{"v":1,"blocks":[{"t":"img","src":"x"}]}', '{"v":1,"blocks":[{"t":"p","c":[],"html":"<b>"}]}', '{"v":2,"blocks":[]}', "{", "[]", "null"])
      expect(parseDoc(j).ok, j).toBe(false);
  });
  it("refuses hidden characters inside the text", () => {
    expect(parseDoc(doc([{ t: "p", c: [{ t: "text", text: "a\u202Eb" }] }])).ok).toBe(false);
  });
  it("refuses documents over the limits", () => {
    expect(parseDoc(doc(Array.from({ length: 401 }, () => ({ t: "divider" }))))).toEqual({ ok: false, reason: "doc_too_large" });
    expect(parseDoc(doc([{ t: "p", c: [{ t: "text", text: "x".repeat(20_001) }] }]))).toEqual({ ok: false, reason: "doc_invalid" });
  });
  it("every legal default is a valid document, and validateOverride uses the document rules", () => {
    for (const k of ["legal.terms", "legal.privacy", "legal.guidelines"] as const) {
      expect(parseDoc(catalogue[k].default).ok, k).toBe(true);
      expect(catalogue[k].placeholders).toEqual([]);
    }
    expect(validateOverride(catalogue["legal.terms"], "<b>x</b>")).toEqual({ ok: false, reason: "doc_invalid" });
    expect(validateOverride(catalogue["legal.terms"], doc([{ t: "p", c: [{ t: "text", text: "Line one" }] }]))).toEqual({ ok: true });
  });
});

describe("safeHref", () => {
  it("keeps web and mail links only", () => {
    expect(safeHref("https://example.com/a")).toBe("https://example.com/a");
    expect(safeHref("mailto:hi@example.com")).toBe("mailto:hi@example.com");
    expect(safeHref("javascript:x")).toBeNull();
  });
});
