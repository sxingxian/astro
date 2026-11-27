import { getCard } from "@astro/cards";
import type { Suit } from "@astro/cards";
import type { T } from "./copy";
import type { Patterns, PatternRange } from "./patterns";

export interface PatternsCopy {
  repeatsTitle: string;
  repeatsLine: string;
  elementsTitle: string;
  elementsLine: string;
  majorsLine: string;
  reversedLine: string;
}

const RANGE = { "30d": "app.patterns.this_month", "90d": "app.patterns.this_season", all: "app.patterns.overall" } as const;
export const ELEMENT_KEY = { wands: "app.card.fire", cups: "app.card.water", swords: "app.card.air", pentacles: "app.card.earth" } as const;
export const SUIT_KEY = { wands: "app.patterns.suit_wands", cups: "app.patterns.suit_cups", swords: "app.patterns.suit_swords", pentacles: "app.patterns.suit_pentacles" } as const;
const ABOUT = { wands: "app.patterns.about_wands", cups: "app.patterns.about_cups", swords: "app.patterns.about_swords", pentacles: "app.patterns.about_pentacles" } as const;

/** Fixed sentence templates for the Patterns view, from the editable wording. Deterministic: no AI, nothing invented. */
export function patternsCopy(p: Patterns, range: PatternRange, t: T): PatternsCopy {
  const times = (n: number) => (n === 2 ? t("app.patterns.times_two") : n === 3 ? t("app.patterns.times_three") : t("app.patterns.times_n", { n: String(n) }));
  const reversedLine = t("app.patterns.reversed_line", { count: String(p.reversed.count), total: String(p.reversed.of) });
  if (p.readings < 3) {
    return {
      repeatsTitle: t("app.patterns.waiting"),
      repeatsLine: t("app.patterns.waiting_repeats"),
      elementsTitle: t("app.patterns.waiting"),
      elementsLine: t("app.patterns.waiting_elements"),
      majorsLine: p.cards ? t("app.patterns.majors_so_far", { pct: String(p.majorShare) }) : t("app.patterns.no_cards"),
      reversedLine: p.cards ? reversedLine : ""
    };
  }
  const top = p.repeats[0];
  const topCard = top ? getCard(top.cardId) : null;
  const [first, second] = p.elements;
  const quietest = p.elements.at(-1);
  const minors = p.elements.reduce((n, e) => n + e.count, 0);
  const leads = first && second && first.count > second.count;
  const el = (s: Suit) => t(ELEMENT_KEY[s]);
  return {
    repeatsTitle: topCard && top ? t("app.patterns.repeats_title", { card: topCard.name, times: times(top.count) }) : t("app.patterns.no_repeat"),
    repeatsLine: topCard ? t("app.patterns.repeats_line", { first: topCard.keywords[0], second: topCard.keywords[1].toLowerCase() }) : t("app.patterns.all_different"),
    elementsTitle: minors === 0 ? t("app.patterns.mostly_majors") : leads ? t("app.patterns.leads", { element: el(first.suit), range: t(RANGE[range]) }) : t("app.patterns.balanced"),
    elementsLine:
      minors === 0
        ? t("app.patterns.no_minors")
        : leads && quietest
          ? t("app.patterns.leads_line", { suit: t(SUIT_KEY[first.suit]), element: el(first.suit), about: t(ABOUT[first.suit]), quiet_element: el(quietest.suit), quiet_about: t(ABOUT[quietest.suit]) })
          : t("app.patterns.balanced_line"),
    majorsLine: t("app.patterns.majors_line", { pct: String(p.majorShare), verdict: t(p.majorShare >= 40 ? "app.patterns.majors_big" : "app.patterns.majors_everyday") }),
    reversedLine
  };
}
