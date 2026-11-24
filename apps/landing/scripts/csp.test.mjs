import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyCsp, collectInlineScriptHashes, PLACEHOLDER } from "./csp.mjs";

describe("collectInlineScriptHashes", () => {
  it("hashes inline scripts and ignores external ones", () => {
    const html = `<script>alert(1)</script><script src="/x.js"></script><script type="application/ld+json">{}</script>`;
    const expected = "sha256-" + createHash("sha256").update("alert(1)").digest("base64");
    const hashes = collectInlineScriptHashes(html);
    expect(hashes).toContain(expected);
    expect(hashes).toHaveLength(2);
  });
});

describe("applyCsp", () => {
  it("replaces the placeholder with the full policy", () => {
    const headers = `/*\n  Content-Security-Policy: ${PLACEHOLDER}\n`;
    const out = applyCsp(headers, ["sha256-abc="]);
    expect(out).not.toContain(PLACEHOLDER);
    expect(out).toContain("script-src 'self' 'sha256-abc='");
    expect(out).toContain("frame-ancestors 'none'");
    expect(out).toContain("object-src 'none'");
  });

  it("throws when the placeholder is missing", () => {
    expect(() => applyCsp("/*\n", [])).toThrow();
  });
});
