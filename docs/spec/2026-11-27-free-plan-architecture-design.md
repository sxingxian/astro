# Astro on Workers Free: pre-built pages and a small data Worker

Status: draft for the owner's approval (27 Nov 2026). No code changes until approved.

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

Local numbers include profiler overhead (it inflates them). The point stands: Next.js costs about the whole budget
before the page does anything. Code trimming cannot get a page from 112 ms to under 10 ms.

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
- No change to the database (Neon via Hyperdrive) or to password hashing (already inside Postgres).

## Anti-goals

- Moving private data into the static files, or trusting the browser for any check.
- A slower first view than today for someone on a phone.

## Approaches considered

1. **Pre-built single-page app (Vite + React) served as static files, plus a small data Worker for `/api/*`.**
   Cloudflare serves the files for free with no Worker run (Workers static assets, with its built-in "single-page
   application" fallback, so every app address opens the same shell without a Worker). The data Worker is plain
   TypeScript with a small router, no React on the server. **Recommended.**
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
4. **Move the data from Neon to Cloudflare D1.** No database login per request, so data calls would be cheapest.
   Rejected for now: replaces the database the project is built on. Kept as the fallback if the gate in stage 0
   fails.

## Design (approach 1)

### Pieces

- **`apps/app` (pages):** Vite + React + React Router + Tailwind, same components and design tokens
  (`@astro/ui`, `@astro/tokens`, `@astro/copy`, `@astro/cards`, `@astro/meanings`, `@astro/draw`). Built to static
  files and served by Workers static assets. Every page loads its data from the data Worker and shows the existing
  loading states.
- **Data Worker (`/api/*`):** one Worker on the same address (`astroapp.midnightpoetry.studio`), invoked only for
  `/api/*` (`run_worker_first: ["/api/*"]`). Everything else is a static file. Endpoints:
  - the existing `POST`/`DELETE` routes (draws, account, reader, invite, offer, reading notes, check-ins), moved
    over with their tests;
  - new read endpoints that replace the server components' queries, one per screen
    (e.g. `GET /api/today`, `/api/journal`, `/api/reading/:id`, `/api/desk/log`), each answering in **one database
    round trip**;
  - sign-in, sign-up, password reset and two-step through Better Auth, on the same paths as now (`/api/auth/*`).
- **Same origin:** pages and API share one address, so cookies stay `HttpOnly`, `Secure`, `SameSite=Lax`, and no
  CORS is opened.

### Keeping each request small

- **Session check without the framework:** the session cookie is verified (HMAC, as Better Auth signs it) and the
  session, user, roles and disabled flag are read in one query. Better Auth stays for the sign-in, sign-up, reset
  and two-step flows, where a slower request is rare.
- **One database connection per request** (`max: 1`), one round trip per screen, closed after the response.
- **Wording:** the published app wording keeps its ~1-minute publish. The data Worker keeps the latest snapshot in
  memory per isolate (as now), and pages fetch it once with their data.
- **Maintenance mode:** checked by the data Worker (cached per isolate, as now). While paused, the API answers 503
  and pages show the notice.

### Security

- Pages hold no private data. Every permission check (session, roles, guidelines, staff-or-reader rules) runs in
  the data Worker or in the database, as now.
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

0. **Measure on Cloudflare first (gate).** Deploy the data Worker with the session check and `GET /api/today`
   only, on a separate test route, and read its real CPU time in Cloudflare's logs. The production database login
   goes to Hyperdrive, not a local Postgres, so the local 4–7 ms may differ. **If the median is over 6 ms, stop and
   come back to the owner** (options: Better Auth's signed-cookie session cache, or D1).
1. **Core screens:** Today, draw one, draw three, reading, verify, journal, Patterns, account, sign-in/up, reset,
   two-step, terms, privacy. The current Next.js Worker is retired for the app when this ships.
2. **The rest:** Ask, check-ins, Desk and My log, invite, offer, reader guidelines, maintenance page.
   (Stages 1 and 2 may ship together if stage 1 shows the pattern works; one switch-over is less risky than two.)
3. **Admin portal:** the same change. Only staff use it, so it is less urgent, but it has the same limit.

Each stage: plan, tests first, full suites green, a PR, merge only on "merge". Deploys stay on Workers Builds; any
dashboard steps are written for the browser only.

## What the owner decides

- Approve approach 1 (pre-built single-page app) over approach 2 (Next.js static export).
- Approve the gate in stage 0, including stopping if the live number is too high.

## Left to the builder

- Router and data-loading library choice (kept small; no server rendering).
- Exact endpoint shapes, as long as each screen is one round trip.
- How the CPU budget check is wired into CI.

## Not changing

Neon project and roles, migrations, Hyperdrive, Resend, Turnstile, Better Auth for sign-in flows, the landing page,
the admin portal until stage 3, the approved designs.
