# Astro: product and technical spec (summary)

The full spec is the Claude Doc "Astro — Product & Build Plan" (https://claude.ai/artifact/1jGAhkd11YPv3MoH5HyoEf). The screen mockups are at https://claude.ai/artifact/BFRgaSVWbDGULjyxKX9gC9. This file holds the decisions that implementation plans rely on.

## Product
- **1-card spread:** one card drawn from all 78 cards.
- **3-card spread:** Past, Present and Future. Each position is one Major Arcana card (the theme) plus one Minor Arcana card (the clarifier), so 6 cards in total.
- **Tiers:**
  - Guest: one 1-card reading per day, not saved.
  - Free account: adds the 3-card spread, the journal and Patterns.
  - Paid, AI insight: instant, labelled as AI.
  - Paid, human reader: delivered within the SLA, 48 h by default, set in admin.
- **Reversals:** on by default, at a 30% reversal rate (configurable in admin).
- **Card meanings:** original text written for Astro (not copied from books or sites): for each of the 78 cards an upright and a reversed meaning (a one-line summary plus an elaborated body), a line for the card as a 3-card theme (Majors) or clarifier (Minors), and a line for each position (Past, Present, Future). Editable later in admin.
- **Patterns (free account):** a view in the Journal showing cards that keep returning, the balance of elements (Minor suits), the Major share, reversals and check-in outcomes over 30 days, 90 days or all time. Deterministic text, no AI. Readings marked private are left out. Mockup: canvas artboard "7b · Patterns".
- **7-day check-in (free account):** 7 to 30 days after a reading, the app asks "How did it turn out?" (It fit / Partly / Not really, plus an optional note). Private; feeds Patterns only; can be turned off in Account. Mockup: canvas artboard "7c · 7-day check-in".
- **Daily limit:** one reading per spread per calendar day, in the user's own timezone. There is no "shuffle again".

## Draw rules
1. The server shuffles each deck with Fisher–Yates driven by `crypto.getRandomValues`, before the user picks.
2. The server stores the deck order. It is never sent to the browser.
3. The user taps a position. The server reveals the card at that position.
4. The 3-card spread is picked in two stages: first 3 cards from a fan of the 22 Majors, then 3 from a fan of the 56 Minors. These are separate shuffles.
5. The shuffle is verifiable:
   - Fingerprint = first 32 hex characters (128 bits) of `SHA-256(order.join(",") + "|" + orientations.join(",") + ":" + salt)`, shown as 8 groups of 4. Orientations are part of the commitment so no card can be flipped after the fingerprint is shown. (Owner decision 2026-11-26: lengthened from 16 hex so two orders cannot practically share a fingerprint.)
   - The salt is 16 random bytes, written as hex.
   - The fingerprint is shown before the pick. The order and salt are revealed only after the reading is complete.

## Addresses
| Surface | Address |
| --- | --- |
| Landing | astro.midnightpoetry.studio |
| App | astroapp.midnightpoetry.studio |
| Admin | astro.midnightpoetry.studio/admin* (a separate Worker on its own route) |

## Stack
- **Repo and apps:** Turborepo with pnpm, Next.js (App Router), TypeScript in strict mode.
- **Hosting:** Cloudflare Workers.
  - Landing: static assets.
  - App and admin: OpenNext.
- **Data:** Neon Postgres (aws-ap-southeast-1) through Hyperdrive, with Drizzle.
- **Accounts:** Better Auth, stored in Neon.
  - Sign-in is email and password only. There is no Google sign-in.
  - TOTP 2-factor sign-in is optional for users and required for staff.
  - Staff roles: owner (one, all access, the only one who edits card meanings and AI settings), admin and moderator work in the admin portal behind Cloudflare Access; readers take paid-reading requests in the app. Everyone joins by invitation; nobody can sign up for a role.
- **Email:** Resend (sign-up confirmation, password reset). Sending domain set in DEPLOYMENT.md.
- **Card art storage:** R2.
- **Payments:** Stripe Checkout, with prices set per currency.
- **AI:** services are added in the admin portal by the owner: Anthropic, OpenAI and Gemini through Cloudflare AI Gateway (not Workers AI), or any OpenAI-compatible service at its own https address. Every AI reading uses three different companies: a writer and two checkers, each with a main service and at least 2 fallbacks. API keys are entered in the portal, encrypted with AES-256-GCM under a Worker secret (`AI_KEY_ENCRYPTION_KEY`), write-only (only the last 4 characters show), and every change needs a fresh authenticator code and emails the owner.
- **Bot protection:** Turnstile on every form and on guest draws, plus Bot Fight Mode, the WAF, and Cloudflare Access on /admin*.
- **CI/CD:** Cloudflare runs every deploy and every database migration; GitHub Actions never deploys and never holds Cloudflare or database credentials.
  - Each Worker (landing, app, admin) is connected to the GitHub repo through **Cloudflare Workers Builds**, with build watch paths so only affected Workers rebuild.
  - Push to `main`: Workers Builds installs, runs lint, typecheck, unit tests and the build, then runs the deploy command. For Workers that own the database the deploy command is `migrate && wrangler deploy`, so a failed migration blocks the deploy.
  - The migrator connection string is a Workers Builds **build secret** (never a runtime secret); runtime Workers connect through Hyperdrive with the `astro_web` / `astro_admin` roles.
  - Migrations are expand-then-contract: the previous Worker version keeps serving while a migration runs, so every migration must work with both the old and the new code.
  - Pull requests: GitHub Actions runs lint, typecheck, unit tests, build and Playwright e2e as a required check. Branch protection on `main` requires it to pass before merge.
  - Non-production branch builds stay off for Workers whose build has the migrator secret.

## Design
- **Colours:** Night #0B0B14, Ink #14142A, Nebula #2A2350, Gold #D8B46A, Moon #EDE6D6, Muted #8C88A6, Error #E26D6D.
- **Light theme (Daybreak):** Paper #F4EEE2, Ink #1B1830, Gold-deep #7A5A1E.
- **Type:** Cormorant Garamond for display, Inter for UI.
- **Spacing and shape:** an 8 px spacing grid, corner radii of 12 and 20, gold hairline borders.
- **Motion:**
  - Easing curves:
    - ease-out `cubic-bezier(0.23,1,0.32,1)`;
    - ease-in-out `cubic-bezier(0.77,0,0.175,1)`.
  - UI transitions stay at or under 300 ms.
  - Reduced motion keeps fades and removes movement.
- **Landing page:** v2 "Scroll journey", in six chapters: Sky, Deck, Pairs, Thread, Promise and Deeper.
  - GSAP ScrollTrigger with Lenis smooth scrolling.
  - A three.js starfield in the hero.
  - A 9-second deck ritual loop: riffle twice, fan, lift, flip to reveal, gather.
- **Accessibility:** WCAG 2.2 AA.
- **Performance budget:** LCP under 2.5 s on 4G. Under 200 KB of JS on app routes; 3D loads only on the landing page.

## Security baseline
- Security headers on every host: a strict CSP, HSTS, `frame-ancestors 'none'`, Referrer-Policy and Permissions-Policy.
- No secrets in the repo. Secrets live in Worker runtime secrets and Workers Builds build secrets; GitHub holds none.
- Zod validates every input.
- Draws, limits, prices and entitlements are decided on the server only.
- Least-privilege database roles: `astro_web`, `astro_admin` and `migrator`.
