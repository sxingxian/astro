# Build plans

Each plan delivers working, tested software on its own branch and pull request.

| # | Plan | Delivers | Status |
| --- | --- | --- | --- |
| 1 | [Foundations and landing page](2026-11-25-foundations-and-landing.md) | Monorepo, CI, design tokens, card catalogue, draw engine (shuffle, fingerprint, verify), the animated landing page v2, Cloudflare deploy for the landing page | Planned |
| 2 | [App core](2026-11-26-app-core.md) | Neon schema and migrations run by Cloudflare Workers Builds (`migrate && deploy`), Better Auth (email and password, optional TOTP), guest and member draws (1-card and 3-card two-stage pick), reveal, verify screen, journal, Patterns, 7-day check-in, Turnstile, card meanings for all 78 cards | Planned, awaiting review |
| 3 | Paid readings | Stripe Checkout with prices per currency, webhooks, the AI provider layer through AI Gateway (Claude, OpenAI, Gemini) with "Challenge this reading", human-reader orders | Later |
| 4 | Admin portal | The admin Worker on /admin* with Cloudflare Access and required 2-factor: requests queue, pricing, AI settings, card library, site settings, users and roles, audit log | Later |
| 5 | Growth | Share cards, draw for a friend, log your own physical deck, "Read it yourself first" learning mode, Simplified Chinese with seasonal spreads, PWA | Later |

Each plan after plan 1 is written once the plan before it has merged, so it can build on the real code.
