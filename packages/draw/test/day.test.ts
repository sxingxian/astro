import { describe, expect, it } from "vitest";
import { isTimeZone, localDay, nextLocalMidnight } from "../src/index";

const at = new Date("2026-11-25T16:30:00Z");

describe("localDay", () => {
  it("uses the person's timezone", () => {
    expect(localDay(at, "Asia/Singapore")).toBe("2026-11-26");
    expect(localDay(at, "America/New_York")).toBe("2026-11-25");
  });
});

describe("isTimeZone", () => {
  it("accepts IANA zones and rejects anything else", () => {
    expect(isTimeZone("Asia/Singapore")).toBe(true);
    expect(isTimeZone("Mars/Base")).toBe(false);
    expect(isTimeZone("")).toBe(false);
  });
});

describe("nextLocalMidnight", () => {
  it("finds the next local midnight", () => {
    expect(nextLocalMidnight(at, "Asia/Singapore").toISOString()).toBe("2026-11-26T16:00:00.000Z");
  });

  it("is correct across a DST change", () => {
    // New York leaves DST on 2026-11-01 at 02:00; midnight on the 2nd is 05:00Z.
    expect(nextLocalMidnight(new Date("2026-11-01T12:00:00Z"), "America/New_York").toISOString()).toBe("2026-11-02T05:00:00.000Z");
  });
});
