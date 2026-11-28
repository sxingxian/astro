import { describe, expect, it } from "vitest";
import { dateParts, daysIn, joinDate, yearsFor } from "@/lib/date-field";

describe("the date picker's parts", () => {
  it("splits a day into day, month and year, and joins them back", () => {
    expect(dateParts("2016-01-01")).toEqual({ day: 1, month: 1, year: 2016 });
    expect(joinDate({ day: 7, month: 9, year: 2026 })).toBe("2026-09-07");
  });

  it("keeps the day inside the month when the month or year changes", () => {
    expect(daysIn(2, 2024)).toBe(29);
    expect(daysIn(2, 2026)).toBe(28);
    expect(joinDate({ day: 31, month: 2, year: 2026 })).toBe("2026-02-28");
    expect(joinDate({ day: 31, month: 4, year: 2026 })).toBe("2026-04-30");
  });

  it("offers the last ten years, newest first, and keeps an older saved year", () => {
    expect(yearsFor(2026, 2026)).toEqual([2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016]);
    expect(yearsFor(2026, 2009).at(-1)).toBe(2009);
  });
});
