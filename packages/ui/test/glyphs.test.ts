import { allCards } from "@astro/cards";
import { describe, expect, it } from "vitest";
import { glyphFor } from "../src/glyphs";

describe("glyphFor", () => {
  it("returns a path for every card", () => {
    for (const card of allCards) expect(glyphFor(card.id, card.suit).length, card.id).toBeGreaterThan(0);
  });
});
