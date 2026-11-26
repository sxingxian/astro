# Writing Astro's card meanings

Every meaning in this package is original text written for Astro. Nothing is copied from, or closely paraphrased from, books, a deck's little white book or websites. Ideas that belong to the shared tarot tradition (The Tower means upheaval, Cups are feelings) are fine; someone else's sentences are not.

## Voice

- Second person ("you"), present tense, reflective and warm.
- Use invitational words: "may", "invites", "suggests", "could". Never promise or predict ("will", "is going to", "definitely").
- No fatalism, no fear. Hard cards name the difficulty honestly and point at what the reader can do with it.
- No health, legal or financial advice. A card can mention work, money or the body as themes; it never tells someone what to do about a diagnosis, a court case or an investment.
- Plain words first. Tarot terms only where they help, and explained in passing.

## Shape

| Field | Length | What it does |
| --- | --- | --- |
| `upright.summary` | 4–14 words | The card in one line |
| `upright.body` | 2–3 paragraphs, 110–220 words | What the card asks you to notice, and a way to work with it |
| `reversed.summary` | 4–14 words | Different from the upright line |
| `reversed.body` | 2 paragraphs, 80–170 words | The card's energy blocked, turned inward or overdone; not "the opposite, bad" |
| `asTheme` (Majors) | 8–30 words | The card as the big theme of a Past, Present or Future position |
| `asClarifier` (Minors) | 8–30 words | How the card shapes the Major beside it in everyday terms |
| `positions.past/present/future` | 8–30 words each | The card read in that position |

## Checks

`test/meanings.test.ts` enforces the lengths, the 78-card coverage, unique summaries and a list of phrases that sound like predictions or professional advice.
