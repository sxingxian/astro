# Build plans

Each plan delivers working, tested software on its own branch and pull request.

| # | Plan | Delivers | Status |
| --- | --- | --- | --- |
| 1 | [Foundations and landing page](2026-11-25-foundations-and-landing.md) | Monorepo, CI, design tokens, card catalogue, draw engine (shuffle, fingerprint, verify), the animated landing page v2, Cloudflare deploy for the landing page | Done (PR #1) |
| 2 | [App core](2026-11-26-app-core.md) | Neon schema and migrations run by Cloudflare Workers Builds (`migrate && deploy`), Better Auth (email and password, optional TOTP), guest and member draws (1-card and 3-card two-stage pick), reveal, verify screen, journal, Patterns, 7-day check-in, Turnstile, card meanings for all 78 cards | Done (PR #6) |
| 3 | [Admin portal](2026-11-26-admin-portal.md) | Part A: the admin Worker on /admin* (Cloudflare Access, invite-only staff, required 2-step, step-up codes), roles (owner, admin, moderator, reader), Users, Site settings, Dashboard, audit log, AI services with encrypted keys and three roles (writer, two checkers) with fallbacks. Part B: editing all wording (landing rebuilt on publish, app live), card meanings (owner only), drafts, previews and history | Part A built (PR pending); Part B next |
| 4 | Paid readings | Stripe Checkout with prices per currency, webhooks, AI readings written and cross-checked by three companies, "Challenge this reading", human-reader requests in the app | Later |
| 5 | Growth | Share cards, draw for a friend, log your own physical deck, "Read it yourself first" learning mode, Simplified Chinese with seasonal spreads, PWA | Later |

Each plan after plan 1 is written once the plan before it has merged, so it can build on the real code.
