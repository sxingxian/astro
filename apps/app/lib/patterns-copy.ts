import { getCard, type Suit } from "@astro/cards";
import type { PatternRange, Patterns } from "./patterns";

export interface PatternsCopy {
  repeatsTitle: string;
  repeatsLine: string;
  elementsTitle: string;
  elementsLine: string;
  majorsLine: string;
  reversedLine: string;
}

const WAITING = "Patterns appear after a few readings";
const RANGE: Record<PatternRange, string> = { "30d": "this month", "90d": "this season", all: "overall" };
const ELEMENT: Record<Suit, { name: string; suit: string; about: string }> = {
  wands: { name: "Fire", suit: "Wands", about: "energy, drive and new ideas" },
  cups: { name: "Water", suit: "Cups", about: "feelings and relationships" },
  swords: { name: "Air", suit: "Swords", about: "thoughts, decisions and honest conversations" },
  pentacles: { name: "Earth", suit: "Pentacles", about: "work, money and the practical side of life" }
};

const times = (n: number) => (n === 2 ? "twice" : n === 3 ? "three times" : `${n} times`);

/** Fixed sentence templates for the Patterns view. Deterministic: no AI, nothing invented. */
export function patternsCopy(p: Patterns, range: PatternRange): PatternsCopy {
  if (p.readings < 3) {
    return {
      repeatsTitle: WAITING,
      repeatsLine: "Draw on a few more days and the cards that keep returning will show up here.",
      elementsTitle: WAITING,
      elementsLine: "Once there are a few readings, you'll see which elements are most present.",
      majorsLine: p.cards ? `${p.majorShare}% of your cards so far were Majors.` : "No cards drawn in this period yet.",
      reversedLine: p.cards ? `${p.reversed.count} of ${p.reversed.of} cards came up reversed.` : ""
    };
  }

  const top = p.repeats[0];
  const topCard = top ? getCard(top.cardId) : null;
  const [first, second] = p.elements;
  const quietest = p.elements.at(-1);
  const minors = p.elements.reduce((n, e) => n + e.count, 0);
  const leads = first && second && first.count > second.count;

  return {
    repeatsTitle: topCard && top ? `${topCard.name} has come up ${times(top.count)}` : "No card has repeated yet",
    repeatsLine: topCard ? `${topCard.keywords[0]} and ${topCard.keywords[1].toLowerCase()} keep surfacing.` : "Each reading has brought a different card so far.",
    elementsTitle: minors === 0 ? "Mostly Majors so far" : leads ? `${ELEMENT[first.suit].name} leads ${RANGE[range]}` : "Your elements are balanced",
    elementsLine:
      minors === 0
        ? "Minor cards show how themes play out day to day; none have come up in this period."
        : leads && quietest
          ? `${ELEMENT[first.suit].suit} and other ${ELEMENT[first.suit].name} cards point to ${ELEMENT[first.suit].about}. ${ELEMENT[quietest.suit].name}, ${ELEMENT[quietest.suit].about}, has been quieter.`
          : "No single element dominates; your readings touch many parts of life.",
    majorsLine: `${p.majorShare}% of cards were Majors: ${p.majorShare >= 40 ? "big themes, not just daily detail" : "mostly everyday detail rather than big themes"}.`,
    reversedLine: `${p.reversed.count} of ${p.reversed.of} cards came up reversed.`
  };
}
