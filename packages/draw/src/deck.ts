import { createCommitment } from "./commitment";
import { assignOrientations, shuffle, type Orientation } from "./shuffle";

export interface Deck {
  order: string[];
  orientations: Orientation[];
  salt: string;
  fingerprint: string;
}

/** Shuffles the cards, decides each card's orientation and commits to both. */
export async function createDeck(cardIds: readonly string[], reversalRate: number): Promise<Deck> {
  const order = shuffle(cardIds);
  const orientations = assignOrientations(order, reversalRate);
  const { salt, fingerprint } = await createCommitment(order, orientations);
  return { order, orientations, salt, fingerprint };
}
