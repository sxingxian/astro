import { describe, expect, it } from "vitest";
import { describeDbError, makeMaintenanceCheck } from "@astro/app-core/maintenance";

describe("maintenance check", () => {
  it("shares one read between requests that arrive together", async () => {
    let reads = 0;
    const check = makeMaintenanceCheck(async () => {
      reads += 1;
      await new Promise((r) => setTimeout(r, 10));
      return true;
    });
    const results = await Promise.all(Array.from({ length: 20 }, () => check(60, 1000)));
    expect(results.every(Boolean)).toBe(true);
    expect(reads).toBe(1);
  });

  it("re-reads after the cache time, and not before", async () => {
    let reads = 0;
    const check = makeMaintenanceCheck(async () => (reads += 1) > 1);
    let t = 0;
    const now = () => t;
    expect(await check(60, 1000, now)).toBe(false);
    t = 59_000;
    expect(await check(60, 1000, now)).toBe(false);
    t = 61_000;
    expect(await check(60, 1000, now)).toBe(true);
    expect(reads).toBe(2);
  });

  it("doesn't wait on a stalled database: after the timeout it keeps the last answer", async () => {
    let first = true;
    const check = makeMaintenanceCheck(() => (first ? ((first = false), Promise.resolve(true)) : new Promise<boolean>(() => {})));
    let t = 0;
    expect(await check(60, 50, () => t)).toBe(true);
    t = 120_000;
    const started = Date.now();
    expect(await check(60, 50, () => t)).toBe(true);
    expect(Date.now() - started).toBeLessThan(500);
  });

  it("treats a failed first read as off", async () => {
    const check = makeMaintenanceCheck(() => Promise.reject(new Error("down")));
    expect(await check(60, 50)).toBe(false);
  });
});

describe("describeDbError", () => {
  it("adds the database's own reason and leaves out the parameters", () => {
    const e = new Error("Failed query: select 1\nparams: secret-ish", { cause: Object.assign(new Error('password authentication failed for user "astro_web"'), { code: "28P01" }) });
    expect(describeDbError(e)).toBe('Failed query: select 1 | cause: 28P01 password authentication failed for user "astro_web"');
  });
});
