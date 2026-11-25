import { describe, expect, it } from "vitest";
import { secureRandomInt } from "../src/index";

describe("secureRandomInt", () => {
  it("returns 0 when there is only one option", () => {
    expect(secureRandomInt(1)).toBe(0);
  });

  it.each([0, -1, 1.5, 2 ** 32 + 1])("rejects %s", (max) => {
    expect(() => secureRandomInt(max)).toThrow(RangeError);
  });

  it("stays in range and covers every value", () => {
    const counts = new Array(6).fill(0);
    for (let i = 0; i < 10_000; i++) {
      const v = secureRandomInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      counts[v]++;
    }
    for (const c of counts) expect(c).toBeGreaterThan(1400);
  });
});
