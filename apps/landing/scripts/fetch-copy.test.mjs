import { mkdtempSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { run } from "./fetch-copy.mjs";

const quiet = { log() {}, warn() {}, error() {} };
const out = () => join(mkdtempSync(join(tmpdir(), "copy-")), "published.json");
const respond = (status, body) => async () => new Response(body === undefined ? null : typeof body === "string" ? body : JSON.stringify(body), { status });

describe("fetch-copy", () => {
  it("fails on a network error and leaves the old file untouched", async () => {
    const path = out();
    writeFileSync(path, '{"version":3,"overrides":{}}');
    const code = await run({ env: {}, outPath: path, log: quiet, fetchFn: async () => { throw new TypeError("fetch failed"); } });
    expect(code).toBe(1);
    expect(readFileSync(path, "utf8")).toBe('{"version":3,"overrides":{}}');
  });

  it("writes version 0 when nothing is published (204)", async () => {
    const path = out();
    expect(await run({ env: {}, outPath: path, log: quiet, fetchFn: respond(204) })).toBe(0);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ version: 0, overrides: {} });
  });

  it("fails on another status or a malformed body", async () => {
    expect(await run({ env: {}, outPath: out(), log: quiet, fetchFn: respond(500, "oops") })).toBe(1);
    expect(await run({ env: {}, outPath: out(), log: quiet, fetchFn: respond(200, "not json") })).toBe(1);
    expect(await run({ env: {}, outPath: out(), log: quiet, fetchFn: respond(200, { version: "7", overrides: {} }) })).toBe(1);
  });

  it("fails when an override breaks its rules, and drops unknown keys", async () => {
    expect(await run({ env: {}, outPath: out(), log: quiet, fetchFn: respond(200, { version: 2, overrides: { "landing.hero.note": "x".repeat(500) } }) })).toBe(1);
    const path = out();
    expect(await run({ env: {}, outPath: path, log: quiet, fetchFn: respond(200, { version: 2, overrides: { "landing.hero.note": "Free, always", "landing.gone": "x", "app.today.title": "y" } }) })).toBe(0);
    expect(JSON.parse(readFileSync(path, "utf8"))).toEqual({ version: 2, overrides: { "landing.hero.note": "Free, always" } });
  });

  it("COPY_SOURCE=defaults fetches nothing", async () => {
    const path = out();
    let called = false;
    expect(await run({ env: { COPY_SOURCE: "defaults" }, outPath: path, log: quiet, fetchFn: async () => { called = true; return new Response(null, { status: 204 }); } })).toBe(0);
    expect(called).toBe(false);
    expect(existsSync(path)).toBe(true);
  });

  it("reads COPY_SOURCE_URL when set", async () => {
    let url = "";
    await run({ env: { COPY_SOURCE_URL: "https://example.test/api/copy/landing" }, outPath: out(), log: quiet, fetchFn: async (u) => { url = String(u); return new Response(null, { status: 204 }); } });
    expect(url).toBe("https://example.test/api/copy/landing");
  });
});
