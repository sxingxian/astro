import type { EntrySpec } from "./types.ts";

const SHORT = 40;
const TITLE = 90;
const LEDE = 400;
const BODY = 240;

/** The landing page, in page order. Defaults are the launch wording, word for word. */
export const landing = {
  "landing.meta.title": { group: "Search and sharing", label: "Page title", where: "Browser tab and search results", default: "Astro — Daily tarot, read slowly", max: 70 },
  "landing.meta.description": { group: "Search and sharing", label: "Search description", where: "Under the title in search results", default: "A free daily tarot card, or three pairs of Major and Minor Arcana, with meanings worth slowing down for.", max: 160 },
  "landing.meta.share_description": { group: "Search and sharing", label: "Sharing description", where: "Link previews in messages and social apps", default: "Every day, one card turns. Free daily tarot by Midnight Poetry Studio.", max: 160 },

  "landing.header.sign_in": { group: "Header", label: "Sign-in link", where: "Top right", default: "Sign in", max: SHORT },
  "landing.header.cta": { group: "Header", label: "Main button", where: "Top right", default: "Draw today's card", max: SHORT },

  "landing.rail.sky": { group: "Chapter rail", label: "Chapter I", where: "Side navigation", default: "I · Sky", max: SHORT },
  "landing.rail.deck": { group: "Chapter rail", label: "Chapter II", where: "Side navigation", default: "II · Deck", max: SHORT },
  "landing.rail.pairs": { group: "Chapter rail", label: "Chapter III", where: "Side navigation", default: "III · Pairs", max: SHORT },
  "landing.rail.thread": { group: "Chapter rail", label: "Chapter IV", where: "Side navigation", default: "IV · Thread", max: SHORT },
  "landing.rail.promise": { group: "Chapter rail", label: "Chapter V", where: "Side navigation", default: "V · Promise", max: SHORT },
  "landing.rail.deeper": { group: "Chapter rail", label: "Chapter VI", where: "Side navigation", default: "VI · Deeper", max: SHORT },

  "landing.hero.chapter": { group: "I · The sky", label: "Chapter label", where: "Above the heading", default: "I · The sky", max: SHORT },
  "landing.hero.title": { group: "I · The sky", label: "Heading", where: "Top of the page. Each line break starts a new line.", default: "Every day,\none card turns.", max: TITLE },
  "landing.hero.lede": { group: "I · The sky", label: "Introduction", where: "Under the heading", default: "A daily tarot ritual for one card, or three pairs of Major and Minor Arcana. Free every day, with meanings worth slowing down for.", max: LEDE },
  "landing.hero.primary": { group: "I · The sky", label: "Main button", where: "Under the introduction", default: "Draw today's card", max: SHORT },
  "landing.hero.secondary": { group: "I · The sky", label: "Second button", where: "Next to the main button", default: "Begin the journey", max: SHORT },
  "landing.hero.note": { group: "I · The sky", label: "Note", where: "Under the buttons", default: "Free · No sign-up for your first card", max: 80 },

  "landing.deck.chapter": { group: "II · The deck", label: "Chapter label", where: "Above the heading", default: "II · The deck", max: SHORT },
  "landing.deck.title": { group: "II · The deck", label: "Heading", where: "Each line break starts a new line.", default: "Seventy-eight cards.\nOne is yours today.", max: TITLE },
  "landing.deck.lede": { group: "II · The deck", label: "Introduction", where: "Under the heading", default: "We shuffle before you choose, and you can check it afterwards. Your hand picks the place in the deck. The deck never changes behind your back.", max: LEDE },
  "landing.deck.step_1": { group: "II · The deck", label: "Step 1", where: "Steps beside the deck", default: "Shuffled before you choose", max: 60 },
  "landing.deck.step_2": { group: "II · The deck", label: "Step 2", where: "Steps beside the deck", default: "You choose a place in the deck", max: 60 },
  "landing.deck.step_3": { group: "II · The deck", label: "Step 3", where: "Steps beside the deck", default: "Your card turns", max: 60 },

  "landing.pairs.chapter": { group: "III · The pairs", label: "Chapter label", where: "Above the heading", default: "III · The pairs", max: SHORT },
  "landing.pairs.title": { group: "III · The pairs", label: "Heading", where: "Each line break starts a new line.", default: "A theme,\nand how it lives\nin your day.", max: TITLE },
  "landing.pairs.lede": { group: "III · The pairs", label: "Introduction", where: "Under the heading", default: "In the three-pair spread, a Major Arcana sets the theme of your past, present and future. A Minor Arcana sits beside it as the clarifier, showing the practical, everyday shape of that theme.", max: LEDE },
  "landing.pairs.past": { group: "III · The pairs", label: "First position", where: "Above the first pair", default: "Past", max: 24 },
  "landing.pairs.present": { group: "III · The pairs", label: "Second position", where: "Above the second pair", default: "Present", max: 24 },
  "landing.pairs.future": { group: "III · The pairs", label: "Third position", where: "Above the third pair", default: "Future", max: 24 },

  "landing.thread.chapter": { group: "IV · The thread", label: "Chapter label", where: "Above the heading", default: "IV · The thread", max: SHORT },
  "landing.thread.title": { group: "IV · The thread", label: "Heading", where: "Each line break starts a new line.", default: "Your journal\nremembers what\nyou forget.", max: TITLE },
  "landing.thread.lede": { group: "IV · The thread", label: "Introduction", where: "Under the heading", default: "See which cards keep returning, how your suits balance, and how the things you asked about actually turned out. Patterns appear on their own; you don't have to keep a spreadsheet.", max: LEDE },
  "landing.thread.month": { group: "IV · The thread", label: "Example: month", where: "Journal example card", default: "Your November", max: SHORT },
  "landing.thread.summary_before": { group: "IV · The thread", label: "Example: before the count", where: "Journal example card", default: "The Star came up ", max: 80 },
  "landing.thread.summary_count": { group: "IV · The thread", label: "Example: the count", where: "Journal example card, highlighted", default: "4 times", max: 30 },
  "landing.thread.summary_after": { group: "IV · The thread", label: "Example: after the count", where: "Journal example card", default: " this month. Your readings leaned towards Cups: feelings over plans.", max: 160 },
  "landing.thread.suit_cups": { group: "IV · The thread", label: "Example: Cups", where: "Journal example suit bars", default: "Cups", max: 24 },
  "landing.thread.suit_wands": { group: "IV · The thread", label: "Example: Wands", where: "Journal example suit bars", default: "Wands", max: 24 },
  "landing.thread.suit_swords": { group: "IV · The thread", label: "Example: Swords", where: "Journal example suit bars", default: "Swords", max: 24 },
  "landing.thread.suit_pentacles": { group: "IV · The thread", label: "Example: Pentacles", where: "Journal example suit bars", default: "Pentacles", max: 24 },
  "landing.thread.check_in": { group: "IV · The thread", label: "Example: check-in", where: "Journal example card", default: "7 days ago you asked about the new role.", max: 120 },

  "landing.promise.chapter": { group: "V · The promise", label: "Chapter label", where: "Above the heading", default: "V · The promise", max: SHORT },
  "landing.promise.title": { group: "V · The promise", label: "Heading", where: "Above the four promises", default: "Four things we'll never change.", max: TITLE },
  "landing.promise.one_title": { group: "V · The promise", label: "Promise i: title", where: "First promise", default: "Your daily card is free, forever", max: 80 },
  "landing.promise.one_body": { group: "V · The promise", label: "Promise i: text", where: "First promise", default: "No paywall creeping in later. Paid readings only add depth.", max: BODY },
  "landing.promise.two_title": { group: "V · The promise", label: "Promise ii: title", where: "Second promise", default: "No ads, no trackers", max: 80 },
  "landing.promise.two_body": { group: "V · The promise", label: "Promise ii: text", where: "Second promise", default: "Your questions are never used to sell you anything.", max: BODY },
  "landing.promise.three_title": { group: "V · The promise", label: "Promise iii: title", where: "Third promise", default: "Shuffles you can verify", max: 80 },
  "landing.promise.three_body": { group: "V · The promise", label: "Promise iii: text", where: "Third promise", default: "A fingerprint before you pick, the full deck after. Nothing changes behind your back.", max: BODY },
  "landing.promise.four_title": { group: "V · The promise", label: "Promise iv: title", where: "Fourth promise", default: "Your readings stay yours", max: 80 },
  "landing.promise.four_body": { group: "V · The promise", label: "Promise iv: text", where: "Fourth promise", default: "Private mode, one-tap export and delete, optional two-factor sign-in.", max: BODY },

  "landing.deeper.chapter": { group: "VI · Go deeper", label: "Chapter label", where: "Above the heading", default: "VI · Go deeper", max: SHORT },
  "landing.deeper.title": { group: "VI · Go deeper", label: "Heading", where: "Above the two options", default: "When a card isn't enough.", max: TITLE },
  "landing.deeper.lede": { group: "VI · Go deeper", label: "Introduction", where: "Under the heading", default: "Have your whole spread read against your own question, instantly by AI or personally by a reader.", max: LEDE },
  "landing.deeper.ai_kicker": { group: "VI · Go deeper", label: "AI: label", where: "AI option, above its name", default: "Instant", max: SHORT },
  "landing.deeper.ai_name": { group: "VI · Go deeper", label: "AI: name", where: "AI option", default: "AI insight", max: SHORT },
  "landing.deeper.ai_body": { group: "VI · Go deeper", label: "AI: text", where: "AI option", default: "Reads all six cards together, asks you questions back, and can argue the other side when you ask it to.", max: BODY },
  "landing.deeper.human_kicker": { group: "VI · Go deeper", label: "Reader: label", where: "Reader option, above its name", default: "Within 48 hours", max: SHORT },
  "landing.deeper.human_name": { group: "VI · Go deeper", label: "Reader: name", where: "Reader option", default: "Human reader", max: SHORT },
  "landing.deeper.human_body": { group: "VI · Go deeper", label: "Reader: text", where: "Reader option", default: "A vetted reader writes to you personally. Fixed price, never per minute.", max: BODY },
  "landing.deeper.price": { group: "VI · Go deeper", label: "Price label", where: "Both options", default: "Priced in the app", max: SHORT },

  "landing.final.title": { group: "Closing", label: "Heading", where: "Last section", default: "Tonight's card is waiting.", max: TITLE },

  "landing.footer.disclaimer": { group: "Footer", label: "Disclaimer", where: "Bottom of the page", default: "For reflection and entertainment. Not a substitute for medical, legal or financial advice.", max: 200 },
  "landing.footer.terms": { group: "Footer", label: "Terms link", where: "Bottom of the page", default: "Terms", max: SHORT },
  "landing.footer.privacy": { group: "Footer", label: "Privacy link", where: "Bottom of the page", default: "Privacy", max: SHORT },
  "landing.footer.copyright": { group: "Footer", label: "Copyright", where: "Bottom of the page", default: "© 2026 Midnight Poetry Studio", max: 80 }
} as const satisfies Record<`landing.${string}`, EntrySpec>;
