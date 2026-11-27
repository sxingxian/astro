import { describe, expect, it } from "vitest";
import { angleStep, edgeVelocity, indexAt, keepVisible, maxRotation } from "@/lib/draw/fan-geometry";

describe("fan geometry", () => {
  it("spaces the cards as approved: 3° for 78, 3.3° for 56, 5.5° for 22", () => {
    expect(angleStep(78)).toBe(3);
    expect(angleStep(56)).toBe(3.3);
    expect(angleStep(22)).toBe(5.5);
  });

  it("slides only within the 115 px edge zone, steady on entering and faster at the edge", () => {
    expect(edgeVelocity(200, 390)).toBe(0);
    expect(edgeVelocity(116, 390)).toBe(0);
    const enterLeft = edgeVelocity(114, 390);
    expect(enterLeft).toBeGreaterThanOrEqual(1.35);
    expect(edgeVelocity(1, 390)).toBeGreaterThan(enterLeft);
    expect(edgeVelocity(1, 390)).toBeLessThanOrEqual(3);
    // Near the left edge the fan turns right to bring the left-hand cards in, and the other way on the right.
    expect(edgeVelocity(276, 390)).toBeLessThanOrEqual(-1.35);
    expect(edgeVelocity(389, 390)).toBeLessThan(edgeVelocity(276, 390));
  });

  it("finds the card under the finger, and nothing away from the fan", () => {
    // Straight up from the pivot, 250 px away, with no rotation: the middle of a 22-card fan.
    expect(indexAt(0, -250, 0, 22)).toBe(11);
    expect(indexAt(0, -50, 0, 22)).toBe(-1);
    expect(indexAt(0, -500, 0, 22)).toBe(-1);
    expect(indexAt(-1000, -10, 0, 22)).toBe(-1);
  });

  it("turns the fan so a chosen card is in view, never past the ends", () => {
    const max = maxRotation(78, 390);
    expect(max).toBeGreaterThan(0);
    const r = keepVisible(0, 0, 78, 390);
    expect(r).toBeGreaterThan(0);
    expect(r).toBeLessThanOrEqual(max);
    expect(keepVisible(77, 0, 78, 390)).toBeGreaterThanOrEqual(-max);
    expect(keepVisible(39, 0, 78, 390)).toBe(0);
  });
});
