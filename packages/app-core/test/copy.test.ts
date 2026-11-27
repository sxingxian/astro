import { describe, expect, it, vi } from "vitest";
import { liveSnapshot, previewSnapshot } from "../src/copy";

const failing = {
  select: () => {
    throw Object.assign(new Error("Failed query: select … params: abcdefghijklmnopqrstuv,app"), { name: "DrizzleQueryError" });
  }
} as never;

describe("wording reads that fail", () => {
  it("log only the kind of error, never the query's values (a preview id)", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await previewSnapshot(failing, "app", "abcdefghijklmnopqrstuv")).toBeNull();
    await liveSnapshot(failing, "meanings");
    const written = spy.mock.calls.flat().map((a) => (a instanceof Error ? `${a.name}: ${a.message} ${JSON.stringify(a)}` : JSON.stringify(a))).join(" ");
    spy.mockRestore();
    expect(written).not.toMatch(/abcdefghijklmnopqrstuv|params/);
    expect(written).toContain("DrizzleQueryError");
  });
});
