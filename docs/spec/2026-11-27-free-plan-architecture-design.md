# Astro on Workers Free: pre-built pages and a small data Worker

Status: draft for the owner's approval (27 Nov 2026, revised the same day). No code changes until approved.

Revision: the owner keeps Astro on Neon (27 Nov). The data Worker follows the pattern of the owner's Zotikos API
(Workers Free): it checks who is signed in from a signed token without a database call, and reaches the database
over HTTPS instead of a Postgres connection with a login on every request.

## Why

Signed-in pages fail in production with "Worker exceeded CPU time limit". Workers Free allows 10 ms of CPU per
request. The app renders every page with Next.js on the Worker.

Measured on 27 Nov:

| Where | What | CPU per request |
|---|---|---|
| Production, last 24 h | all requests | median 112 ms, p99 474 ms |
| Local, same runtime, profiler on | `/api/health` (returns `{ok:true}`) | ~10 ms |
| Local | signed-out pages | 20–35 ms |
| Local | signed-in pages | 30–47 ms |
| Local, throwaway lean Worker (no Next.js) | `/api/health` | ~0 ms |
| Local, lean Worker | session check + one query | 9–19 ms, of which 4–7 ms is the local database login |

Local numbers include profiler overhead (it inflates them). Two points stand: Next.js costs about the whole budget
before the page does anything, so trimming cannot get a page from 112 ms to under 10 ms; and once Next.js is gone,
most of what is left is opening a Postgres connection and logging in on every request.

How the owner's other Workers Free projects avoid both (read from their repos, 27 Nov):

- **Zyra and Zotikos:** React + Vite pages built ahead as static files; the Worker in front only adds security
  headers. Sign-in runs on Supabase's servers, not the Worker.
- **Zotikos API (Hono):** checks the sign-in token's signature (no database call) and reaches the database over
  HTTPS through Supabase's client, so there is no database login per request.

The owner's constraint: **stay on Workers Free** (set at the start of the project).

## Goals

- Signed-in and signed-out use works on Workers Free, with headroom: target a median under 5 ms CPU per Worker
  request, and none over 10 ms in normal use.
- The screens look and behave as they do now (the approved mockups).
- Security stays at the same level or better.
- A test stops this from creeping back.

## Non-goals

- No new features. Plan 4 Part 2 (paid readings) waits until this ships.
- No change to the landing page (already static).
- No change of database provider: Astro stays on Neon (owner, 27 Nov). Password hashing stays inside Postgres.

## Anti-goals

- Moving private data into the static files, or trusting the browser for any check.
- A slower first view than today for someone on a phone.

## Approaches considered

1. **Pre-built single-page app (Vite + React) served as static files, plus a small data Worker for `/api/*`.**
   Cloudflare serves the files for free with no Worker run (Workers static assets, with its built-in "single-page
   application" fallback, so every app address opens the same shell without a Worker). The data Worker is plain
   TypeScript with Hono (a small router), no React on the server. **Recommended.**
   - For: the cheapest runtime possible; a strict page security policy is simple (all scripts are files, no inline
     scripts); one build for all routes.
   - Against: every page file changes from Next.js server components to client components that load their data;
     Next-specific bits (`next/link`, `next/navigation`, `next/font`) are replaced.
2. **Next.js static export plus the same data Worker.** Keeps Next.js as the build tool.
   - For: page files keep their folder layout.
   - Against: pages still have to become client pages; addresses with ids (`/reading/[id]`, `/check-in/[id]`,
     `/desk/log/[id]`) can't be pre-built, so they need a Worker rewrite or a change to query strings; Next.js puts
     many inline scripts in every page, so the security policy needs per-page hashes generated after each build.
3. **Keep Next.js on the Worker and trim.** Rejected: the framework alone uses the budget (table above).
4. **Move to Supabase like Zyra and Zotikos.** Rejected by the owner: Astro stays on Neon. It would also mean
   moving every account and the whole sign-in system.
5. **Move the data to Cloudflare D1.** Rejected: Astro stays on Neon.

## Design (approach 1)

### Pieces

- **`apps/app` (pages):** Vite + React + React Router + Tailwind, same components and design tokens
  (`@astro/ui`, `@astro/tokens`, `@astro/copy`, `@astro/cards`, `@astro/meanings`, `@astro/draw`). Built to static
  files and served by Workers static assets. Every page loads its data from the data Worker and shows the existing
  loading states.
- **Data Worker (`/api/*`):** Hono, as in Zotikos. One Worker on the same address (`astroapp.midnightpoetry.studio`),
  invoked only for `/api/*` (`run_worker_first: ["/api/*"]`). Everything else is a static file, with the
  single-page-app fallback handled by Cloudflare's static assets, so no Worker runs for pages. Endpoints:
  - the existing `POST`/`DELETE` routes (draws, account, reader, invite, offer, reading notes, check-ins), moved
    over with their tests;
  - new read endpoints that replace the server components' queries, one per screen
    (e.g. `GET /api/today`, `/api/journal`, `/api/reading/:id`, `/api/desk/log`), each answering in **one database
    round trip**;
  - sign-in, sign-up, password reset and two-step through Better Auth, on the same paths as now (`/api/auth/*`),
    which also issue the short-lived token described below.
- **Same origin:** pages and API share one address, so cookies stay `HttpOnly`, `Secure`, `SameSite=Lax`, and no
  CORS is opened.

### Keeping each request small

- **Who is signed in, without a database call.** Sign-in, sign-up, reset and two-step stay on Better Auth, and the
  session list stays in Neon (so "sign out everywhere", disabling a person and role changes still work). After
  sign-in, the data Worker also sets a short-lived signed cookie (HMAC-SHA-256 with a Worker secret; `HttpOnly`,
  `Secure`, `SameSite=Lax`) holding the user id, session id, roles, disabled flag and an expiry of **5 minutes**.
  Ordinary requests only check that signature. When it has expired, the Worker re-reads the session in Neon and
  issues a fresh one. Better Auth's own signed session cache (`session.cookieCache`) is the reference for this.
- **Always checked in the database, never from the token:** changing the password or email, two-step on/off,
  deleting the account, signing out other sessions, accepting an invite or role offer, giving up the reader role,
  exporting My log, and anything a reader or staff role allows that writes data.
- **The database over HTTPS:** the data Worker uses Neon's HTTPS driver (`@neondatabase/serverless` with Drizzle's
  `neon-http`) instead of postgres.js through Hyperdrive. Each query is one HTTPS request: no connection handshake
  or database login on the Worker.
  - The connection string for the `astro_web` role becomes a Worker secret (it now lives in the Hyperdrive
    configuration). The admin portal keeps Hyperdrive until stage 3.
  - That driver has no open-ended transactions. The five places that use one (accept invite, accept role offer,
    give up reader, saving a draw, writing an audit row) move into Postgres functions, as `accept_invite` and
    `accept_role_offer` already are, so each is a single call and stays all-or-nothing.
  - Better Auth runs with its transactions off on this driver, or on Neon's WebSocket driver for the sign-in
    routes only (rare requests). Stage 0 measures both and picks.
- **One HTTPS round trip per screen:** each read endpoint answers with one query (or one batch).
- **Wording:** the published app wording keeps its ~1-minute publish. The data Worker keeps the latest snapshot in
  memory per isolate (as now), and pages fetch it once with their data.
- **Maintenance mode:** checked by the data Worker (cached per isolate, as now). While paused, the API answers 503
  and pages show the notice.

### Security

- Pages hold no private data. Every permission check (session, roles, guidelines, staff-or-reader rules) runs in
  the data Worker or in the database, as now.
- **The token** carries no private data beyond ids and roles, is signed with a secret only the Worker holds, and is
  bound to the sign-in cookie: it holds a hash of the session token and is rejected if the two don't match.
  Rotating the secret signs everyone's token out of the fast path, never out of their account.
- **Page security policy (CSP):** a fixed header from `_headers` (static assets), `script-src 'self'` plus
  Turnstile, no inline scripts, `frame-ancestors 'none'`, `upgrade-insecure-requests`. The other security headers
  move to `_headers` as well. This replaces the per-request nonce, which a pre-built file can't carry.
- **Origin checks and rate limits** on state-changing endpoints stay as they are (`@astro/server` `origin.ts`,
  `limits.ts`), and the guest-draw rate limit binding moves to the data Worker.
- The draft-wording preview (`?astro-preview=<id>`) becomes a data Worker parameter with the same id check.

### The test that keeps it from creeping back

- A CPU budget check in CI: run the data Worker locally, sign in, call every read endpoint and the main writes,
  and fail if any goes over a set budget under the profiler (starting at the measured baseline plus a margin).
- Production check after each stage: the Cloudflare metrics page shows CPU per request; the stage isn't done until
  the median is under 5 ms and nothing exceeds the limit for a day.

## Stages

0. **Measure on Cloudflare first (gate).** Deploy the data Worker with sign-in, the token check, the Neon HTTPS
   driver and `GET /api/today` only, on a separate test address, and read its real CPU time in Cloudflare's logs:
   a token-only request, a request that refreshes the token, `GET /api/today`, and a sign-in.
   **If the median for ordinary requests is over 6 ms, stop and come back to the owner** before any page is
   rebuilt.
1. **Core screens:** Today, draw one, draw three, reading, verify, journal, Patterns, account, sign-in/up, reset,
   two-step, terms, privacy. The current Next.js Worker is retired for the app when this ships.
2. **The rest:** Ask, check-ins, Desk and My log, invite, offer, reader guidelines, maintenance page.
   (Stages 1 and 2 may ship together if stage 1 shows the pattern works; one switch-over is less risky than two.)
3. **Admin portal:** the same change. Only staff use it, so it is less urgent, but it has the same limit.

Each stage: plan, tests first, full suites green, a PR, merge only on "merge". Deploys stay on Workers Builds; any
dashboard steps are written for the browser only.

## What the owner decides

- Approve approach 1 (pre-built React + Vite pages, as in Zyra and Zotikos) over approach 2 (Next.js static export).
- Approve the 5-minute token: signing out everywhere, disabling a person or removing a role reaches ordinary pages
  within 5 minutes at most (the sensitive actions listed above are checked at once). A shorter time costs more
  database reads; 5 minutes is the suggested balance.
- Approve the gate in stage 0, including stopping if the live number is too high.

## Related, separate

Astro's live data sits in the niko-knowledge Neon project (found 27 Nov); the astro Neon project is empty. Moving
it is its own step, planned with the owner. Since this change needs a new connection string anyway, that is a
natural moment, but it is not part of this design.

## Left to the builder

- Router and data-loading library choice (kept small; no server rendering).
- Exact endpoint shapes, as long as each screen is one round trip.
- How the CPU budget check is wired into CI.

## Not changing

Neon and its roles, migrations (new functions are added, nothing removed), Resend, Turnstile, Better Auth for the
sign-in flows, the landing page, the admin portal until stage 3 (still on Hyperdrive), the approved designs.
