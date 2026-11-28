import { describe, expect, it } from "vitest";
import { formatDate, weekdayOf } from "../src/dates.ts";

// One way to show a date everywhere (owner, 28 Nov): "01 Jan 2016". Built by hand, so no browser or language
// setting can change it (en-GB alone would write "1 Jan" in places and "Sept" for September).

describe("formatDate()", () => {
  it("writes a calendar day as DD Mon YYYY", () => {
    expect(formatDate("2016-01-01")).toBe("01 Jan 2016");
    expect(formatDate("2026-09-07")).toBe("07 Sep 2026");
    expect(formatDate("2026-11-28")).toBe("28 Nov 2026");
  });

  it("reads a moment in the given time zone", () => {
    const lateUtc = new Date("2026-11-28T20:30:00Z"); // already the 29th in Singapore
    expect(formatDate(lateUtc, "UTC")).toBe("28 Nov 2026");
    expect(formatDate(lateUtc, "Asia/Singapore")).toBe("29 Nov 2026");
    expect(formatDate("2026-11-28T20:30:00.000Z", "Asia/Singapore")).toBe("29 Nov 2026");
  });

  it("shows nothing for a missing or broken date, rather than 'Invalid Date'", () => {
    expect(formatDate("")).toBe("");
    expect(formatDate("not a date")).toBe("");
    expect(formatDate(new Date(Number.NaN))).toBe("");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(formatDate(new Date("2026-11-28T20:30:00Z"), "Not/AZone")).toBe("28 Nov 2026");
  });
});

describe("weekdayOf()", () => {
  it("names the day of the week in the given time zone", () => {
    const lateUtc = new Date("2026-11-28T20:30:00Z");
    expect(weekdayOf(lateUtc, "UTC")).toBe("Saturday");
    expect(weekdayOf(lateUtc, "Asia/Singapore")).toBe("Sunday");
  });
});
