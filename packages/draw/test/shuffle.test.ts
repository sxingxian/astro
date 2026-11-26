import { describe, expect, it } from "vitest";
import { assignOrientations, shuffle } from "../src/index";

describe("shuffle", () => {
  it("returns a permutation without mutating the input", () => {
    const input = ["a", "b", "c", "d", "e"];
    const copy = [...input];
    const out = shuffle(input);
    expect(input).toEqual(copy);
    expect([...out].sort()).toEqual([...input].sort());
  });

  it("is Fisher–Yates from the end", () => {
    expect(shuffle(["a", "b", "c"], () => 0)).toEqual(["b", "c", "a"]);
  });

  // 5,500 secure shuffles: expected 250 hits, standard deviation about 15.5. The bounds sit about 4.5 standard
  // deviations out (a false failure is roughly 1 in 150,000) and still catch a biased shuffle. The 30 s ceiling
  // is for slow, busy build machines (Cloudflare Workers Builds runs lint, typecheck and tests side by side).
  it("places a given card first about 1/22 of the time", { timeout: 30_000 }, () => {
    const deck = Array.from({ length: 22 }, (_, i) => (i === 0 ? "the-fool" : `card-${i}`));
    let first = 0;
    for (let i = 0; i < 5_500; i++) if (shuffle(deck)[0] === "the-fool") first++;
    expect(first).toBeGreaterThan(180);
    expect(first).toBeLessThan(320);
  });
});

describe("assignOrientations", () => {
  const order = ["a", "b", "c", "d"];
  it("is all upright at rate 0 and all reversed at rate 1", () => {
    expect(assignOrientations(order, 0)).toEqual(["upright", "upright", "upright", "upright"]);
    expect(assignOrientations(order, 1)).toEqual(["reversed", "reversed", "reversed", "reversed"]);
  });
  it("rejects a rate outside 0..1", () => {
    expect(() => assignOrientations(order, 1.5)).toThrow(RangeError);
  });
});
