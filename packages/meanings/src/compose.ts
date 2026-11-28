import type { Meaning } from "./types";

export interface PairCard {
  meaning: Meaning;
  /** The card's name as shown, e.g. "Ten of Cups". */
  name: string;
  reversed: boolean;
}

const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const reversedNote = (m: Meaning) => ` Reversed, it can also mean ${lowerFirst(m.reversed.summary.replace(/\.$/, ""))}.`;

/**
 * The two lines under a three-pair position: what the Major means there, then what its Minor clarifier adds,
 * naming that card. Each says something new; the reversed meaning is added only for a reversed card.
 */
export function pairText(major: PairCard, clarifier: PairCard, position: "past" | "present" | "future"): { theme: string; clarifier: string } {
  const theme = major.meaning.positions[position] + (major.reversed ? reversedNote(major.meaning) : "");
  const adds = clarifier.meaning.asClarifier ?? clarifier.meaning.upright.summary;
  const line = `The ${clarifier.name} ${lowerFirst(adds)}${/[.!?]$/.test(adds) ? "" : "."}` + (clarifier.reversed ? reversedNote(clarifier.meaning) : "");
  return { theme, clarifier: line };
}
