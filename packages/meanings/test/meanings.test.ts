import { allCards, majors, UnknownCardError } from "@astro/cards";
import { describe, expect, it } from "vitest";
import { allMeanings, getMeaning } from "../src/index";

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const total = (paras: string[]) => paras.reduce((n, p) => n + words(p), 0);
const banned = /\b(will (die|happen|definitely)|guarantee|diagnos|cure|lawsuit|invest(ment)? advice)\b/i;
const majorIds = new Set(majors.map((c) => c.id));

describe("meanings", () => {
  it("covers exactly the 78 cards", () => {
    expect(allMeanings).toHaveLength(78);
    expect(allMeanings.map((m) => m.cardId).sort()).toEqual(allCards.map((c) => c.id).sort());
  });

  for (const m of allMeanings) {
    describe(m.cardId, () => {
      it("has summaries of 4–14 words", () => {
        for (const s of [m.upright.summary, m.reversed.summary]) {
          expect(words(s), s).toBeGreaterThanOrEqual(4);
          expect(words(s), s).toBeLessThanOrEqual(14);
        }
      });

      it("has an upright body of 2–3 paragraphs and 110–220 words", () => {
        expect(m.upright.body.length).toBeGreaterThanOrEqual(2);
        expect(m.upright.body.length).toBeLessThanOrEqual(3);
        expect(total(m.upright.body)).toBeGreaterThanOrEqual(110);
        expect(total(m.upright.body)).toBeLessThanOrEqual(220);
      });

      it("has a reversed body of 2 paragraphs and 80–170 words", () => {
        expect(m.reversed.body).toHaveLength(2);
        expect(total(m.reversed.body)).toBeGreaterThanOrEqual(80);
        expect(total(m.reversed.body)).toBeLessThanOrEqual(170);
      });

      it("has position lines of 8–30 words", () => {
        for (const s of Object.values(m.positions)) {
          expect(words(s), s).toBeGreaterThanOrEqual(8);
          expect(words(s), s).toBeLessThanOrEqual(30);
        }
      });

      it("has the right pair line for its arcana", () => {
        if (majorIds.has(m.cardId)) {
          expect(m.asClarifier).toBeUndefined();
          expect(words(m.asTheme ?? "")).toBeGreaterThanOrEqual(8);
          expect(words(m.asTheme ?? "")).toBeLessThanOrEqual(30);
        } else {
          expect(m.asTheme).toBeUndefined();
          expect(words(m.asClarifier ?? "")).toBeGreaterThanOrEqual(8);
          expect(words(m.asClarifier ?? "")).toBeLessThanOrEqual(30);
        }
      });

      it("avoids fatalism and professional advice", () => {
        const text = [m.upright.summary, ...m.upright.body, m.reversed.summary, ...m.reversed.body, ...Object.values(m.positions), m.asTheme ?? "", m.asClarifier ?? ""].join(" ");
        expect(text).not.toMatch(banned);
      });
    });
  }

  it("never repeats a summary", () => {
    const all = allMeanings.flatMap((m) => [m.upright.summary, m.reversed.summary]);
    expect(new Set(all).size).toBe(all.length);
  });

  it("looks meanings up by card id", () => {
    expect(getMeaning("the-star").upright.summary.length).toBeGreaterThan(0);
    expect(() => getMeaning("nope")).toThrow(UnknownCardError);
  });
});
