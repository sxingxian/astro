import { describe, expect, it } from "vitest";
import { csvCell } from "@/lib/reader-log";

describe("csvCell", () => {
  it("neutralises cells a spreadsheet would run as a formula", () => {
    expect(csvCell("=SUM(A1)")).toBe("\"'=SUM(A1)\"");
    for (const lead of ["+", "-", "@", "\t", "\r"]) expect(csvCell(`${lead}x`)).toBe(`"'${lead}x"`);
  });

  it("doubles quotes and keeps line breaks inside the quotes", () => {
    expect(csvCell('She said "yes"')).toBe('"She said ""yes"""');
    expect(csvCell("one\ntwo")).toBe('"one\ntwo"');
    expect(csvCell("plain")).toBe('"plain"');
  });
});
