import { describe, expect, it } from "vitest";
import { colors, contrastRatio } from "../src/index";

describe("contrastRatio", () => {
  it("returns 21 for white on black and 1 for identical colours", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 1);
    expect(contrastRatio("#D8B46A", "#D8B46A")).toBe(1);
  });
});

describe("text colour pairs meet WCAG AA (4.5:1)", () => {
  const pairs: Array<[string, string, string]> = [
    ["moon on night", colors.moon, colors.night],
    ["moon on ink", colors.moon, colors.ink],
    ["muted on night", colors.muted, colors.night],
    ["gold on night", colors.gold, colors.night],
    ["night on gold (button text)", colors.night, colors.gold],
    ["inkDay on paper", colors.inkDay, colors.paper],
    ["goldDeep on paper", colors.goldDeep, colors.paper]
  ];
  it.each(pairs)("%s", (_label, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
