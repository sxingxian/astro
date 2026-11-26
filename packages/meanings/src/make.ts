import type { Meaning } from "./types";

type Upright = [summary: string, ...body: string[]];
type Reversed = [summary: string, first: string, second: string];

/** Builds a Minor's meaning: upright [summary, ...paragraphs], reversed [summary, p1, p2]. */
export function minor(cardId: string, up: Upright, rev: Reversed, asClarifier: string, past: string, present: string, future: string): Meaning {
  const [upSummary, ...upBody] = up;
  const [revSummary, ...revBody] = rev;
  return { cardId, upright: { summary: upSummary, body: upBody }, reversed: { summary: revSummary, body: revBody }, asClarifier, positions: { past, present, future } };
}
