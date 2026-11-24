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
- **Daily limit:** one reading per spread per calendar day, in the user's own timezone. There is no "shuffle again".

## Draw rules
1. The server shuffles each deck with Fisher–Yates driven by `crypto.getRandomValues`, before the user picks.
2. The server stores the deck order. It is never sent to the browser.
3. The user taps a position. The server reveals the card at that position.
4. The 3-card spread is picked in two stages: first 3 cards from a fan of the 22 Majors, then 3 from a fan of the 56 Minors. These are separate shuffles.
5. The shuffle is verifiable:
   - Fingerprint = first 16 hex characters of `SHA-256(order.join(",") + "|" + orientations.join(",") + ":" + salt)`. Orientations are part of the commitment so no card can be flipped after the fingerprint is shown.
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
- **Card art storage:** R2.
- **Payments:** Stripe Checkout, with prices set per currency.
- **AI:** the provider is chosen in admin (Claude, OpenAI or Gemini) and called through Cloudflare AI Gateway, not Workers AI. API keys exist only as Worker secrets.
- **Bot protection:** Turnstile on every form and on guest draws, plus Bot Fight Mode, the WAF, and Cloudflare Access on /admin*.
- **CI/CD:**
  - Pull requests: GitHub Actions runs lint, typecheck and tests, then migrates a Neon branch and deploys a preview.
  - `main`: migrate production, then `wrangler deploy`.
  - A failed migration blocks the deploy.

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
- No secrets in the repo. Secrets live in Worker secrets and GitHub Actions secrets.
- Zod validates every input.
- Draws, limits, prices and entitlements are decided on the server only.
- Least-privilege database roles: `astro_web`, `astro_admin` and `migrator`.
