import { describe, expect, it } from "vitest";
import { fill, resolve, validateOverride } from "../src/validate.ts";
import type { CopyEntry } from "../src/types.ts";

const entry = (over: Partial<CopyEntry> = {}): CopyEntry => ({ key: "app.test.hi", surface: "app", group: "Test", label: "Hi", where: "test", default: "Hi {name}", max: 20, placeholders: ["name"], ...over });

describe("validateOverride", () => {
  it("refuses text over the maximum", () => {
    expect(validateOverride(entry(), "Hi {name}" + "x".repeat(20))).toEqual({ ok: false, reason: "too_long" });
  });
  it("refuses text that drops a placeholder", () => {
    expect(validateOverride(entry(), "Hello")).toEqual({ ok: false, reason: "placeholders" });
  });
  it("refuses text that adds an unknown placeholder", () => {
    expect(validateOverride(entry(), "Hi {name} {email}")).toEqual({ ok: false, reason: "placeholders" });
  });
  it("accepts a placeholder used twice", () => {
    expect(validateOverride(entry(), "Hello {name} {name}")).toEqual({ ok: true });
  });
  it("refuses control characters but allows line breaks", () => {
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "\u0007")).toEqual({ ok: false, reason: "control_chars" });
    expect(validateOverride(entry({ default: "x\ny", placeholders: [] }), "line one\nline two")).toEqual({ ok: true });
  });
  it("allows line breaks only where the default has one (no newlines in subjects or buttons)", () => {
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "Subject\n")).toEqual({ ok: false, reason: "line_breaks" });
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "Subject\rBcc: a@b.c")).toEqual({ ok: false, reason: "line_breaks" });
  });
  it("refuses invisible and direction-changing characters anywhere", () => {
    for (const c of ["\u200B", "\u200D", "\u202E", "\u2066", "\u2028", "\uFEFF", "\u0085"])
      expect(validateOverride(entry({ default: "x", placeholders: [] }), `a${c}b`)).toEqual({ ok: false, reason: "invisible_chars" });
  });
  it("refuses web addresses in email wording only", () => {
    const mail = entry({ key: "email.verify.line1", surface: "email", default: "x", max: 200, placeholders: [] });
    for (const v of ["Go to https://evil.example", "visit www.evil.example", "see evil.example now"])
      expect(validateOverride(mail, v)).toEqual({ ok: false, reason: "links" });
    expect(validateOverride(mail, "This link expires in one hour.")).toEqual({ ok: true });
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "see astro.example")).toEqual({ ok: true });
  });
  it("refuses empty text", () => {
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "   ")).toEqual({ ok: false, reason: "empty" });
  });
  it("accepts markup as plain text, because output is always escaped", () => {
    expect(validateOverride(entry({ default: "x", placeholders: [] }), "<b>x</b>")).toEqual({ ok: true });
  });
});

describe("resolve and fill", () => {
  it("uses the override when there is one, otherwise the default", () => {
    expect(resolve(entry(), {})).toBe("Hi {name}");
    expect(resolve(entry(), { "app.test.hi": "Hello {name}" })).toBe("Hello {name}");
  });
  it("fills placeholders and leaves unknown ones alone", () => {
    expect(fill("Hi {name}, {name}! {other}", { name: "Ada" })).toBe("Hi Ada, Ada! {other}");
  });
});
