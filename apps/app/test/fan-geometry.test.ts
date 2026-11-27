import { describe, expect, it } from "vitest";
import { angleStep, baseAngle, cardAngle, cardLift, coastStep, DESKTOP_FAN, dragDegrees, edgeVelocity, geometryFor, indexAt, keepVisible, maxRotation, PHONE_FAN } from "@/lib/draw/fan-geometry";

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

  it("uses the prototype's size on phones and mockup D2's larger cards on desktop", () => {
    expect(geometryFor(390)).toMatchObject({ cardW: 70, cardH: 116, radius: 256 });
    expect(geometryFor(320)).toMatchObject({ cardW: 70, cardH: 116, radius: 256 });
    expect(geometryFor(900)).toMatchObject({ cardW: 104, cardH: 170, radius: 370 });
    // A point between the pivot and the cards picks nothing on desktop, where the cards sit further out.
    expect(indexAt(0, -150, 0, 78, geometryFor(390))).toBeGreaterThanOrEqual(0);
    expect(indexAt(0, -150, 0, 78, geometryFor(900))).toBe(-1);
    expect(indexAt(0, -300, 0, 78, geometryFor(900))).toBe(39);
    expect(cardLift(5, 5, false, geometryFor(900))).toBeGreaterThan(cardLift(5, 5, false, geometryFor(390)));
  });

  it("treats a fan that fits but for less than one card as fitting: no sliding, no arrows", () => {
    expect(maxRotation(22, 880, geometryFor(880))).toBe(0);
  });

  it("keeps the 78-card fan wider than the stage at every width, so the edges always slide", () => {
    for (const w of [320, 390, 640, 900, 1100]) expect(maxRotation(78, w, geometryFor(w)), `${w} px`).toBeGreaterThan(0);
  });

  it("turns the fan so a chosen card, lifted, stays fully on a small phone screen", () => {
    for (const w of [320, 390]) {
      const g = geometryFor(w);
      for (const i of [0, 10, 19, 40, 77]) {
        const rot = keepVisible(i, 0, 78, w, g);
        const a = (baseAngle(i, 78, rot) * Math.PI) / 180;
        const centre = w / 2 + (g.radius + g.lift) * Math.sin(a);
        expect(centre - g.cardW / 2, `${w} px, card ${i}`).toBeGreaterThanOrEqual(0);
        expect(centre + g.cardW / 2, `${w} px, card ${i}`).toBeLessThanOrEqual(w);
      }
    }
  });

  it("finds the card that is drawn under the finger while a lifted card has nudged its neighbours apart", () => {
    const at = (deg: number) => [250 * Math.sin((deg * Math.PI) / 180), -250 * Math.cos((deg * Math.PI) / 180)] as const;
    // 78 cards, card 40 (index 39) lifted: index 41 is drawn at 9.9°, index 40 at 5.7°.
    expect(cardAngle(41, 78, 0, 39)).toBeCloseTo(9.9);
    expect(indexAt(...at(9.6), 0, 78, PHONE_FAN, 39)).toBe(41);
    expect(indexAt(...at(6), 0, 78, PHONE_FAN, 39)).toBe(40);
    // With nothing lifted the resting positions are used, as before.
    expect(indexAt(...at(9.6), 0, 78, PHONE_FAN)).toBe(42);
  });

  it("turns the fan with the finger: dragging left turns it left by the distance moved along the cards", () => {
    expect(dragDegrees(-100, PHONE_FAN)).toBeCloseTo((-100 / 198) * (180 / Math.PI));
    expect(dragDegrees(100, PHONE_FAN)).toBeGreaterThan(0);
    // The larger desktop fan turns less for the same distance.
    expect(Math.abs(dragDegrees(100, DESKTOP_FAN))).toBeLessThan(dragDegrees(100, PHONE_FAN));
  });

  it("lets a flicked fan coast to a stop at the same pace on any screen refresh rate", () => {
    expect(coastStep(2, 1)).toBeCloseTo(2 * 0.94);
    expect(coastStep(-2, 1)).toBeCloseTo(-2 * 0.94);
    // Two half-length frames (120 Hz) slow it as much as one full frame (60 Hz).
    expect(coastStep(coastStep(2, 0.5), 0.5)).toBeCloseTo(coastStep(2, 1));
    expect(coastStep(0.01, 1)).toBe(0);
  });
});
