import { describe, expect, it } from "vitest";
import { allMeanings as MEANINGS, getMeaning } from "../src/index";
import { pairText } from "../src/compose";

const sentences = (text: string) => text.split(/(?<=\.)\s+/).map((s) => s.trim().toLowerCase());

describe("pairText()", () => {
  it("leads with what the Major means in this position, then what its clarifier adds, naming that card", () => {
    const out = pairText({ meaning: getMeaning("the-sun"), name: "The Sun", reversed: false }, { meaning: getMeaning("ten-of-cups"), name: "Ten of Cups", reversed: false }, "past");
    expect(out.theme).toBe(getMeaning("the-sun").positions.past);
    expect(out.clarifier).toBe("The Ten of Cups brings harmony, so this theme may centre on family, loving relationships or emotional fulfilment.");
  });

  it("adds the reversed meaning only for a reversed card", () => {
    const sun = getMeaning("the-sun");
    const out = pairText({ meaning: sun, name: "The Sun", reversed: true }, { meaning: getMeaning("two-of-cups"), name: "Two of Cups", reversed: true }, "future");
    expect(out.theme).toBe(`${sun.positions.future} Reversed, it can also mean joy dimmed by clouds, or optimism stretched too far.`);
    expect(out.clarifier).toMatch(/^The Two of Cups brings partnership, .+\. Reversed, it can also mean .+\.$/);
  });

  it("never says the same sentence twice, for any Major and Minor in any position", () => {
    const majors = MEANINGS.filter((m) => m.asTheme !== undefined);
    const minors = MEANINGS.filter((m) => m.asClarifier !== undefined);
    expect(majors).toHaveLength(22);
    expect(minors).toHaveLength(56);
    for (const pos of ["past", "present", "future"] as const)
      for (const [i, major] of majors.entries())
        for (const reversed of [false, true]) {
          const minor = minors[(i * 7 + (reversed ? 3 : 0)) % minors.length]!;
          const out = pairText({ meaning: major, name: major.cardId, reversed }, { meaning: minor, name: minor.cardId, reversed: !reversed }, pos);
          const all = [...sentences(out.theme), ...sentences(out.clarifier)];
          expect(new Set(all).size, `${major.cardId} + ${minor.cardId} (${pos})`).toBe(all.length);
        }
  });

  it("every clarifier reads as a sentence about the card that brings it", () => {
    for (const m of MEANINGS.filter((x) => x.asClarifier !== undefined)) expect(m.asClarifier, m.cardId).toMatch(/^Brings [^:]+, so this theme [^:]+\.$/);
  });
});
