import { describe, expect, it } from "vitest";
import { allCards, getCard, majors, minors, UnknownCardError } from "../src/index";

describe("card catalogue", () => {
  it("has 78 cards: 22 majors and 56 minors", () => {
    expect(allCards).toHaveLength(78);
    expect(majors).toHaveLength(22);
    expect(minors).toHaveLength(56);
  });

  it("has unique kebab-case ids", () => {
    const ids = allCards.map((c) => c.id);
    expect(new Set(ids).size).toBe(78);
    for (const id of ids) expect(id).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("numbers the majors 0 to 21 in order", () => {
    expect(majors.map((c) => c.number)).toEqual(Array.from({ length: 22 }, (_, i) => i));
    expect(majors.every((c) => c.arcana === "major" && c.suit === null)).toBe(true);
  });

  it("has 14 cards numbered 1 to 14 in each suit", () => {
    for (const suit of ["wands", "cups", "swords", "pentacles"] as const) {
      const inSuit = minors.filter((c) => c.suit === suit);
      expect(inSuit.map((c) => c.number)).toEqual(Array.from({ length: 14 }, (_, i) => i + 1));
    }
  });

  it("maps suits to elements", () => {
    const element = (suit: string) => minors.find((c) => c.suit === suit)?.element;
    expect([element("wands"), element("cups"), element("swords"), element("pentacles")]).toEqual(["fire", "water", "air", "earth"]);
  });

  it("describes The Star", () => {
    const star = getCard("the-star");
    expect(star).toMatchObject({ name: "The Star", element: "air", numeral: "XVII", number: 17, arcana: "major" });
  });

  it("uses the agreed ids for clarifier examples", () => {
    expect(getCard("ace-of-cups").number).toBe(1);
    expect(getCard("king-of-pentacles").number).toBe(14);
    expect(getCard("wheel-of-fortune").numeral).toBe("X");
    expect(getCard("page-of-wands").number).toBe(11);
  });

  it("throws UnknownCardError for an unknown id", () => {
    expect(() => getCard("nope")).toThrow(UnknownCardError);
  });

  it("gives every card exactly three non-empty keywords", () => {
    for (const card of allCards) {
      expect(card.keywords).toHaveLength(3);
      for (const k of card.keywords) expect(k.trim().length).toBeGreaterThan(0);
    }
  });
});
