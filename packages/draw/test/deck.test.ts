import { describe, expect, it } from "vitest";
import { createDeck, FINGERPRINT_HEX, verifyCommitment } from "../src/index";

const ids22 = Array.from({ length: 22 }, (_, i) => `card-${i}`);

describe("createDeck", () => {
  it("returns a committed permutation of the input", async () => {
    const d = await createDeck(ids22, 0);
    expect(d.order).toHaveLength(22);
    expect(new Set(d.order).size).toBe(22);
    expect([...d.order].sort()).toEqual([...ids22].sort());
    expect(d.orientations.every((o) => o === "upright")).toBe(true);
    expect(d.fingerprint).toHaveLength(FINGERPRINT_HEX);
    expect(await verifyCommitment(d.order, d.orientations, d.salt, d.fingerprint)).toBe(true);
  });

  it("reverses every card at rate 1", async () => {
    const d = await createDeck(ids22, 1);
    expect(d.orientations.every((o) => o === "reversed")).toBe(true);
  });

  it("rejects an out-of-range reversal rate", async () => {
    await expect(createDeck(ids22, 1.5)).rejects.toThrow(RangeError);
  });
});
