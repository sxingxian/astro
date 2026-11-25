export const APP_URL = "https://astroapp.midnightpoetry.studio";

export const links = {
  today: `${APP_URL}/today`,
  signIn: `${APP_URL}/sign-in`,
  deeperAi: `${APP_URL}/deeper?tier=ai`,
  deeperHuman: `${APP_URL}/deeper?tier=human`
} as const;

export const DISCLAIMER = "For reflection and entertainment. Not a substitute for medical, legal or financial advice.";
export const PRICE_LABEL = "Priced in the app";

export const chapters = [
  { id: "top", label: "I · Sky" },
  { id: "deck", label: "II · Deck" },
  { id: "pairs", label: "III · Pairs" },
  { id: "thread", label: "IV · Thread" },
  { id: "promise", label: "V · Promise" },
  { id: "deeper", label: "VI · Deeper" }
] as const;

export const hero = {
  chapter: "I · The sky",
  lines: ["Every day,", "one card turns."] as const,
  lede: "A daily tarot ritual for one card, or three pairs of Major and Minor Arcana. Free every day, with meanings worth slowing down for.",
  primary: "Draw today's card",
  secondary: "Begin the journey",
  note: "Free · No sign-up for your first card"
};

export const deck = {
  chapter: "II · The deck",
  title: ["Seventy-eight cards.", "One is yours today."],
  lede: "We shuffle before you choose, and you can check it afterwards. Your hand picks the place in the deck. The deck never changes behind your back.",
  steps: ["Shuffled before you choose", "You choose a place in the deck", "Your card turns"],
  chosenCardId: "the-star"
};

export const pairs = {
  chapter: "III · The pairs",
  title: ["A theme,", "and how it lives", "in your day."],
  lede: "In the three-pair spread, a Major Arcana sets the theme of your past, present and future. A Minor Arcana sits beside it as the clarifier, showing the practical, everyday shape of that theme.",
  items: [
    { position: "Past", major: "the-tower", minor: "five-of-pentacles" },
    { position: "Present", major: "strength", minor: "three-of-cups" },
    { position: "Future", major: "the-sun", minor: "page-of-wands" }
  ]
};

export const thread = {
  chapter: "IV · The thread",
  title: ["Your journal", "remembers what", "you forget."],
  lede: "See which cards keep returning, how your suits balance, and how the things you asked about actually turned out. Patterns appear on their own; you don't have to keep a spreadsheet.",
  example: {
    month: "Your November",
    cardId: "the-star",
    summary: ["The Star came up ", "4 times", " this month. Your readings leaned towards Cups: feelings over plans."] as const,
    suits: [
      { name: "Cups", pct: 38 },
      { name: "Wands", pct: 24 },
      { name: "Swords", pct: 21 },
      { name: "Pentacles", pct: 17 }
    ],
    checkIn: "7 days ago you asked about the new role."
  }
};

export const promises = {
  chapter: "V · The promise",
  title: "Four things we'll never change.",
  items: [
    { mark: "i.", title: "Your daily card is free, forever", body: "No paywall creeping in later. Paid readings only add depth." },
    { mark: "ii.", title: "No ads, no trackers", body: "Your questions are never used to sell you anything." },
    { mark: "iii.", title: "Shuffles you can verify", body: "A fingerprint before you pick, the full deck after. Nothing changes behind your back." },
    { mark: "iv.", title: "Your readings stay yours", body: "Private mode, one-tap export and delete, optional two-factor sign-in." }
  ]
};

export const deeper = {
  chapter: "VI · Go deeper",
  title: "When a card isn't enough.",
  lede: "Have your whole spread read against your own question, instantly by AI or personally by a reader.",
  tiers: [
    { kicker: "Instant", name: "AI insight", body: "Reads all six cards together, asks you questions back, and can argue the other side when you ask it to.", href: links.deeperAi, featured: false },
    { kicker: "Within 48 hours", name: "Human reader", body: "A vetted reader writes to you personally. Fixed price, never per minute.", href: links.deeperHuman, featured: true }
  ]
};

export const finalCta = { title: "Tonight's card is waiting." };
