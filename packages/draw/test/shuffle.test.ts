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

  it("places a given card first about 1/22 of the time", () => {
    const deck = Array.from({ length: 22 }, (_, i) => (i === 0 ? "the-fool" : `card-${i}`));
    let first = 0;
    for (let i = 0; i < 22_000; i++) if (shuffle(deck)[0] === "the-fool") first++;
    expect(first).toBeGreaterThan(800);
    expect(first).toBeLessThan(1200);
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
