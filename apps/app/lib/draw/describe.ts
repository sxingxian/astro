import { getCard, type Card } from "@astro/cards";
import type { Meaning } from "@astro/meanings";
import type { Orientation } from "@astro/draw";
import type { T } from "@astro/copy";

export interface CardText {
  card: Card;
  meaning: Meaning;
  orientation: Orientation;
  reversed: boolean;
  side: Meaning["upright"];
  title: string;
  line: string;
}

const ELEMENT = { fire: "app.card.fire", water: "app.card.water", air: "app.card.air", earth: "app.card.earth" } as const;

/**
 * Everything the reveal shows for one drawn card, in its orientation, with the published wording (t) and card
 * meanings (meaningOf, from getMeanings()). Server-only: meanings never ship to the browser.
 */
export function describe(cardId: string, orientation: Orientation, t: T, meaningOf: (cardId: string) => Meaning): CardText {
  const card = getCard(cardId);
  const meaning = meaningOf(cardId);
  const reversed = orientation === "reversed";
  return {
    card,
    meaning,
    orientation,
    reversed,
    side: reversed ? meaning.reversed : meaning.upright,
    title: reversed ? t("app.card.reversed_title", { name: card.name }) : card.name,
    line: `${t(reversed ? "app.card.reversed" : "app.card.upright")} · ${t(card.arcana === "major" ? "app.card.major" : "app.card.minor")} · ${t(ELEMENT[card.element])}`
  };
}
