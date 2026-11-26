import { getCard, type Card } from "@astro/cards";
import { getMeaning, type Meaning } from "@astro/meanings";
import type { Orientation } from "@astro/draw";

export interface CardText {
  card: Card;
  meaning: Meaning;
  orientation: Orientation;
  reversed: boolean;
  side: Meaning["upright"];
  title: string;
  line: string;
}

const element: Record<Card["element"], string> = { fire: "Fire", water: "Water", air: "Air", earth: "Earth" };

/** Everything the reveal shows for one drawn card, in its orientation. Server-only: meanings never ship to the browser. */
export function describe(cardId: string, orientation: Orientation): CardText {
  const card = getCard(cardId);
  const meaning = getMeaning(cardId);
  const reversed = orientation === "reversed";
  return {
    card,
    meaning,
    orientation,
    reversed,
    side: reversed ? meaning.reversed : meaning.upright,
    title: reversed ? `${card.name}, reversed` : card.name,
    line: `${reversed ? "Reversed" : "Upright"} · ${card.arcana === "major" ? "Major Arcana" : "Minor Arcana"} · ${element[card.element]}`
  };
}
