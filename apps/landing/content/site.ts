// Links and card choices for the landing page. Every piece of wording lives in @astro/copy (edited in the admin
// portal) and is read through content/copy.ts.
export const APP_URL = "https://astroapp.midnightpoetry.studio";

export const links = {
  today: `${APP_URL}/today`,
  signIn: `${APP_URL}/sign-in`,
  terms: `${APP_URL}/terms`,
  privacy: `${APP_URL}/privacy`,
  deeperAi: `${APP_URL}/deeper?tier=ai`,
  deeperHuman: `${APP_URL}/deeper?tier=human`
} as const;

export const chapterIds = ["top", "deck", "pairs", "thread", "promise", "deeper"] as const;

export const deckCardId = "the-star";

export const pairCards = [
  { major: "the-tower", minor: "five-of-pentacles" },
  { major: "strength", minor: "three-of-cups" },
  { major: "the-sun", minor: "page-of-wands" }
] as const;

export const threadExample = { cardId: "the-star", suitPcts: [38, 24, 21, 17] } as const;
