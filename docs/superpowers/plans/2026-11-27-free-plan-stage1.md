# Free-plan Stage 1 (pre-built pages + data Worker) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in Astro works again on Workers Free. The app's everyday screens become pre-built React pages
served as static files, and `astro-api` grows into the Worker that serves them plus every API they need, each
request within the free plan's 10 ms.

**Architecture:**
- New workspace `apps/web`: Vite + React 19 + React Router + Tailwind 4, built to static files.
- `apps/api` (the `astro-api` Worker) serves those files through Workers static assets, with the single-page-app
  fallback, so no Worker runs for a page view. It runs Hono only for `/api/*` and for the reader paths still served
  by the old app.
- Framework-free logic moves out of `apps/app/lib` into a new package `packages/app-core`, so the API imports it
  cleanly. The old app keeps re-exporting it until Stage 2.
- Reads go over Neon's HTTPS driver, one request per screen (batched). The few interactive transactions (draw
  start, sign-in flows) use Neon's WebSocket driver for that request only.
- Reader-only pages (Desk, My log, invite, offer, reader guidelines) are not rebuilt in this stage. `astro-api`
  forwards them to the old Next.js Worker through a service binding.
- At cutover the app's address moves from `astro-app` to `astro-api` (browser steps, with a written rollback).

**Tech Stack:** Vite, React 19, React Router, Tailwind 4, Hono, Better Auth, Drizzle (`neon-http`,
`neon-serverless`), Vitest, Playwright, wrangler dev.

**Spec:** `docs/spec/2026-11-27-free-plan-architecture-design.md` (approved 27 Nov). Stage 0 measured live
27 Nov: `/api/v2/today` 5–9 ms with five separate queries; all requests p50 4.3 ms, 0 over the limit. The owner
approved going on with the rule "one database request per screen".

## Global Constraints

- **CPU** (Workers Free, 10 ms per request):
  - local CPU check: every endpoint passes the budget check in CI;
  - live gate before the cutover is called done: every read endpoint's median under 6 ms with a pass, nothing
    exceeding the limit for a day.
- **Database:** Neon only, `astro_web` role.
  - Reads: `@astro/db/http`, at most one HTTPS request per screen (one query or one `batch`).
  - Interactive transactions: `@astro/db/ws` (WebSocket `Pool`, `max: 1`, closed at the end of the request), only in
    `startDraw` and in Better Auth's own writes if its tests need them.
- **The pass:** 5 minutes, as in Stage 0.
  - Sensitive actions always re-check Neon: password, email, two-step on/off, delete account, sign out other
    sessions.
  - When the pass is refreshed, the session's expiry is extended by the same rule as Better Auth:
    `expiresIn = sessionHours`, `updateAge = min(24, sessionHours)` hours.
- **Security:**
  - Every state-changing endpoint keeps its existing origin check, Turnstile and rate limits (`GUEST_DRAWS`
    binding moves to `astro-api`).
  - Errors never log query values.
  - Static pages carry no private data.
  - CSP from `_headers`, the same policy as now minus the nonce: `script-src 'self' https://challenges.cloudflare.com`,
    no inline scripts in `index.html`.
- **Behaviour:** screens look and behave as now (approved mockups, PR #24 layouts, PR #25 fan picker).
  - Wording keeps its ~1-minute publish.
  - `?astro-preview=<id>` keeps working with the same id check.
  - Maintenance mode: while paused, the API answers 503 except `/api/health` and `/api/copy/landing`, and pages show
    the notice.
- **Delivery:**
  - Deploys stay on Workers Builds; any dashboard step is browser-only.
  - Secrets are never committed.
  - Branch `feat/free-plan-stage1`, one PR, merge only on "merge".
- **Unchanged:** the admin portal and the landing page. The landing build keeps reading `/api/copy/landing` from
  the app's address.

## Review Focus

1. **Signed out ↔ signed in transitions on static pages:**
   - a stale pass after sign-out must not show the old person's data: sign-out clears `astro.pass`, and the API
     refuses a pass whose session token hash differs;
   - a page cached in the browser must refetch its data, never show cached JSON (`no-store` on all API responses).
2. **Deep links and refreshes on every route** (`/reading/<id>`, `/check-in/<id>`, `/reading/<id>/verify`) must
   load the app shell, not a 404. A legacy path (`/desk/log/<id>`) must reach the old app, not the SPA fallback.
3. **Better Auth on the new drivers:** sign-up, email verification link, sign-in, two-step challenge, trusted
   device, password reset, sign out. Each must behave exactly as now, including rate limits and Turnstile.
4. **Concurrency in `startDraw`:** two simultaneous starts for the same person must still produce one reading (the
   advisory lock must hold on the WebSocket client).
5. **Maintenance and preview** keep working with no Worker running for pages: the SPA must show the maintenance
   notice from the API's 503, and must pass `astro-preview` to the API for draft wording.

---

### Task 1: `packages/app-core` (logic out of Next.js)

**Files:**
- Create `packages/app-core/` (package.json, tsconfig, vitest configs, `src/index.ts` plus modules).
- Move from `apps/app/lib`: `draw/service.ts`, `draw/errors.ts`, `draw/guest.ts` (pure parts), `journal.ts`,
  `check-ins.ts`, `patterns.ts`, `readers.ts` (read side), `account.ts`, `legal.ts`, `copy.ts` (snapshot logic
  without `next/headers`), `maintenance.ts` (read side), `auth-options.ts`, `mail.ts`, `mail-templates.ts`,
  `env.ts` (schema).
- Leave in `apps/app/lib` thin re-exports, plus the Next-specific glue (`headers()`, `cache`).
- Move their tests (`apps/app/test/*.db.test.ts` for those modules) with them.

**Interfaces:**
- Produces the same function names and signatures, with `db: AnyDb` in place of `Db`.
- Every `db.execute` read goes through `rowsOf`.
- `startDraw(db, …)` takes a `TxDb` (a client that supports `.transaction`).

- [ ] Move the files and the tests; `apps/app` imports from `@astro/app-core`.
- [ ] Run the moved db tests on both drivers (postgres.js and the Neon stand-in) where the module is on a read path.
- [ ] The full existing suite passes unchanged (unit, db, app e2e 55, admin e2e 37). Commit.

### Task 2: WebSocket client for the few transactions

**Files:** `packages/db/src/ws.ts` (export `@astro/db/ws`), `packages/db/src/testing.ts` (`neonWsOverPostgres`),
`packages/db/test/ws.db.test.ts`

**Interfaces:**
- `createWsDb(url, opts?: { wsProxy?: string }): { db: TxDb; end(): Promise<void> }`.
- Test helper `neonWsOverPostgres(url): { proxy: string; close() }`: a local WebSocket server that pipes Neon's
  Postgres-over-WebSocket frames to the local Postgres, so the real `neon-serverless` driver runs in tests.

- [ ] Tests: a transaction commits; a thrown error rolls back; `pg_advisory_xact_lock` blocks a second
      transaction until the first ends.
- [ ] Two parallel `startDraw` calls for one person give one session (moved test, now on the WebSocket client).
- [ ] RED → implement → GREEN. Commit.

### Task 3: Session check grows up

**Files:** `apps/api/src/session.ts`, `apps/api/test/session.db.test.ts`

**Interfaces:**
- `lookupSession(db, token, { sessionHours, updateAge })`: one statement (CTE) that returns the session and person
  as now, and extends `expires_at` to `now() + sessionHours` when it would expire within
  `sessionHours − updateAge`.
- The pass gains `email`, `emailVerified` and `twoFactor` (needed by the account screen and the sign-in redirects),
  still bound to the token hash.

- [ ] Tests: expiry extended only inside the window; values unchanged otherwise; disabled/portal/expired refused
      as before.
- [ ] RED → GREEN. Commit.

### Task 4: Better Auth in the Worker

**Files:** `apps/api/src/auth.ts`, `apps/api/test/auth.db.test.ts`

**Interfaces:** `ALL /api/auth/*` → Better Auth handler, built once per isolate from `authOptions(env, deps)`
(`@astro/app-core`).
- Database: the HTTPS client with the Drizzle adapter's transactions off. If a flow needs a transaction (the
  tests decide), that route uses the WebSocket client.
- Mail: Resend as now. The outbox driver stays for local runs.
- Sign-out and session revoke also clear `astro.pass`.

- [ ] Tests (Hono `app.request` against the stand-ins), each with the same assertions as today's auth e2e:
      sign-up, verification link, sign-in, wrong password, two-step challenge, trusted device, password reset,
      sign-out, Turnstile required, rate limits.
- [ ] RED → GREEN. Commit.

### Task 5: State-changing endpoints

**Files:** `apps/api/src/routes/{draw,reading,check-in,account,copy,health}.ts`, tests per file.

**Interfaces:** the same paths, methods, bodies and answers as the current Next routes:
- `/api/draw/start`, `/api/draw/pick`, `/api/draw/[id]`;
- `/api/reading/[id]/note|private`;
- `/api/check-in/[id]`;
- `/api/account/{check-ins,delete,password,sessions/revoke,time-zone,two-step/enable,two-step/disable}`;
- `/api/copy/landing`, `/api/health`.

Shared middleware applies to all of them: origin check (`@astro/server/origin`), maintenance gate, security
headers, `no-store`, and safe error logging. The guest draw keeps its signed guest cookie, Turnstile and
`GUEST_DRAWS` limit.

- [ ] Port each route's existing tests (db tests and the e2e assertions on status and body) to Hono requests.
      RED → GREEN per route. Commit per route group.

### Task 6: Read endpoints, one database request per screen

**Files:** `apps/api/src/routes/reads.ts`, `apps/api/test/reads.db.test.ts`

**Interfaces** (all `GET`, signed in unless noted, each issuing at most one Neon request via `db.batch`):
- `/api/session` (signed out allowed) → `{ user | null, wording, maintenance, preview }`;
- `/api/today`, `/api/journal?cursor=`, `/api/patterns`, `/api/reading/:id`, `/api/reading/:id/verify`,
  `/api/account`, `/api/check-in/:id`;
- `/api/legal/:kind` (signed out allowed).

Each returns what today's server component renders.

- [ ] Tests: every endpoint's JSON equals what the current page functions return for the same person, on the Neon
      stand-in.
- [ ] Each endpoint makes exactly one stand-in request (counted), or zero on a pass hit with cached wording for
      `/api/session`.
- [ ] RED → GREEN. Commit.

### Task 7: Reader pages forwarded to the old app

**Files:** `apps/api/src/legacy.ts`, `apps/api/wrangler.jsonc` (service binding `LEGACY` → `astro-app`),
`apps/api/test/legacy.test.ts`

**Interfaces:**
- Forwarded to `env.LEGACY.fetch(request)`: `/desk*`, `/invite`, `/offer`, `/reader-guidelines`, `/_next/*`,
  `/api/reader/*`, `/api/invite/*`, `/api/offer/*`.
- Everything else is the SPA or `/api/*`.

- [ ] Tests: each forwarded path reaches a stub binding unchanged (method, headers, body); `/today` and
      `/reading/x` never do. RED → GREEN. Commit.

### Task 8: `apps/web` shell

**Files:** `apps/web/` (Vite config, `index.html`, `src/main.tsx`, `src/router.tsx`, `src/api.ts`, `src/copy.tsx`,
`src/styles.css` from `apps/app/app/globals.css`, `public/_headers`, fonts), `apps/api/wrangler.jsonc` (assets:
`../web/dist`, `not_found_handling: "single-page-application"`, `run_worker_first` for `/api/*` and the legacy
paths).

**Interfaces:**
- `api<T>(path, init?)`: always `credentials: "same-origin"` and `cache: "no-store"`.
  - 401 → sign-in with `?next=`; 503 maintenance → the maintenance screen; other errors → the existing error view.
- `CopyProvider` fed from `/api/session`.
- `AppShell` and `AuthShell` ported from the Next components, same markup and classes.
- Loading states use the existing skeleton styles.

- [ ] Tests: unit tests for `api()` status handling.
- [ ] Playwright: every route deep-links and refreshes into the shell; the CSP header is present on `index.html`;
      no inline script in the built `index.html`. RED → GREEN. Commit.

### Task 9: Screens

**Files:** `apps/web/src/routes/*` and the moved client components (`components/draw`, `today`, `journal`,
`account`, `check-in`, auth forms, `Turnstile`, `DocView`).

**Scope:** sign-in, sign-up, forgot, reset, two-step, Today, draw one, draw three, reading, verify, journal,
Patterns, account, check-in, terms, privacy, Ask, maintenance, not found. `next/link` → React Router `Link`;
`useRouter`/`redirect`/`notFound` → React Router equivalents. Server components become routes that load from
Task 6's endpoints.

- [ ] Port the app e2e specs for these screens (auth, auth-pages, auth-hardening, draw, fan, journal,
      check-in, legal, shell, desktop, disabled, maintenance, copy-endpoint, budget) to run against the
      new Worker.
- [ ] They pass unchanged in their assertions; where a spec reads server-rendered HTML, it waits for the client
      render instead.
- [ ] Commit per screen group.

### Task 10: CPU budget, all endpoints

**Files:** `apps/api/scripts/cpu-budget.ts` (paths list, POST support), `apps/api/test/cpu-budget.cpu.test.ts`

- [ ] Budget check covers every read endpoint (with and without a pass), `draw/start`, `draw/pick`, sign-in, and
      `/api/session` signed out. Same noise-tolerant guard as Stage 0.
- [ ] Record local medians in the spec. Commit.

### Task 11: Cutover and rollback steps

**Files:** `docs/DEPLOYMENT.md` (§17 rewritten: "astro-api serves the app"), `apps/app/wrangler.jsonc` (no custom
domain; reached only through the service binding).

- [ ] Browser-only steps:
  1. Merge.
  2. Wait for both builds to go green.
  3. **astro-app → Settings → Domains & Routes:** remove `astroapp.midnightpoetry.studio`.
  4. **astro-api → Deployments → Retry build:** the deploy claims the custom domain.
  5. Open `/api/health`, sign in, check Today.

  Expected downtime: the minute between steps 3 and 4.
- [ ] Rollback (browser-only):
  1. **astro-api → Settings → Domains & Routes:** remove the custom domain.
  2. **astro-app → Settings → Domains & Routes:** add `astroapp.midnightpoetry.studio` back.
- [ ] After cutover: Claude reads astro-api's Observability (CPU per endpoint for a day) against the gate, and
      records the numbers in the spec.
- [ ] Full suites green (lint, typecheck, unit, db, CPU, e2e for web, admin and landing, plus the legacy reader
      specs through the binding). Final review by a fresh reviewer. PR; merge only on "merge".
