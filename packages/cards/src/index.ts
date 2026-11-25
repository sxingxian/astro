import { majors } from "./majors";
import { minors } from "./minors";
import type { Card } from "./types";

export type { Arcana, Card, Element, Suit } from "./types";
export { majors, minors };

export const allCards: readonly Card[] = [...majors, ...minors];

const byId = new Map(allCards.map((card) => [card.id, card]));

export class UnknownCardError extends Error {
  constructor(id: string) {
    super(`Unknown card id: ${id}`);
    this.name = "UnknownCardError";
  }
}

export function getCard(id: string): Card {
  const card = byId.get(id);
  if (!card) throw new UnknownCardError(id);
  return card;
}
