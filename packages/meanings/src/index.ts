import { getCard, UnknownCardError } from "@astro/cards";
import { cups } from "./cups";
import { majors } from "./majors";
import { pentacles } from "./pentacles";
import { swords } from "./swords";
import type { Meaning } from "./types";
import { wands } from "./wands";

export type { Meaning, Side } from "./types";
export { applyOverrides, fieldText, MEANING_FIELDS, type MeaningField } from "./fields";

const modules: Meaning[] = [...majors, ...wands, ...cups, ...swords, ...pentacles];

export const allMeanings: readonly Meaning[] = modules;

const byId = new Map(allMeanings.map((m) => [m.cardId, m]));

export function getMeaning(cardId: string): Meaning {
  getCard(cardId);
  const m = byId.get(cardId);
  if (!m) throw new UnknownCardError(cardId);
  return m;
}
export { pairText, type PairCard } from "./compose";
