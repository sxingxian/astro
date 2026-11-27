# Free-plan Stage 0 (measurement gate) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A small Hono data Worker, live on `astroapp.midnightpoetry.studio/api/v2/*`, that recognises the existing
sign-in, issues the 5-minute pass, reaches Neon over HTTPS and serves Today's data, so its real CPU time can be read
on Cloudflare before any page is rebuilt.

**Architecture:** New workspace `apps/api` (Hono on Workers, no React). The route `/api/v2/*` on the app's host takes
precedence over the app's custom domain (as `/admin*` does on the landing host), so the browser sends the existing
`astro.session_token` cookie and no sign-in UI is needed. `packages/db` gains an HTTPS (Neon) client and a
driver-neutral `Db` type; `packages/server` gains the pass. Today's existing data functions are reused unchanged
apart from reading `execute()` results driver-neutrally.

**Tech Stack:** Hono, `@neondatabase/serverless` + `drizzle-orm/neon-http`, Web Crypto HMAC-SHA-256, Vitest,
wrangler dev + the Chrome DevTools profiler for the CPU budget.

**Spec:** `docs/spec/2026-11-27-free-plan-architecture-design.md` (approved 27 Nov).

## Global Constraints

- Workers Free: 10 ms CPU per request. Gate: median under 6 ms for ordinary requests, live.
- Neon stays the database. The `astro_web` role is the data Worker's only database identity.
- Pass: HMAC-SHA-256, Worker secret `PASS_SECRET` (min 32 chars), lifetime 300 s, cookie `astro.pass`,
  `HttpOnly; Secure; SameSite=Lax; Path=/api`, bound to SHA-256 of the session token.
- Session rules unchanged: `surface = 'app'`, not expired, user not disabled (`acceptSession`).
- Sensitive actions never trust the pass (none exist in Stage 0; Stage 0 serves reads only).
- `GET` only in Stage 0; any other method → 405. Security headers on every response
  (`securityHeaders` from the app), `cache-control: no-store`.
- Secrets are set in the Cloudflare dashboard, never committed. Deployment steps are browser-only; deploy and build
  run on Workers Builds, not GitHub Actions.
- No change to the current app's behaviour; the old Worker keeps serving everything except `/api/v2/*`.

## Review Focus

1. A pass from another session (stolen or after sign-out on this device) must be refused: binding to the session
   token hash, tested in Task 2.
2. A pass outliving a disabled account or a revoked session by more than 300 s: refresh re-reads Neon, tested in
   Task 3/4.
3. HTTPS driver result shapes differ from postgres.js (`{ rows }` vs array; numeric and date parsing): Today's data
   must come out identical on both drivers, tested in Task 1 and Task 4.
4. Clock skew or a malformed cookie must not throw (500) but read as signed out: tested in Task 2.
5. The CPU budget test must fail when a request is too heavy, not only pass: Task 5 includes a deliberate slow
   route in its own test.

---

### Task 1: HTTPS database client and driver-neutral results

**Files:**
- Modify: `packages/db/src/index.ts`, `packages/db/package.json` (add `@neondatabase/serverless`)
- Create: `packages/db/src/http.ts`, `packages/db/src/neon-fake.ts` (test helper, exported from `@astro/db/testing`)
- Modify: `apps/app/lib/readers.ts`, `apps/app/lib/draw/service.ts` (Today path only: `rowsOf`)
- Test: `packages/db/test/http.db.test.ts`

**Interfaces:**
- Produces: `type Db = PgDatabase<PgQueryResultHKT, typeof schema>`; `createHttpDb(url: string, opts?: { fetch?: typeof fetch }): Db`;
  `rowsOf<T>(r: unknown): T[]` (accepts postgres.js arrays and `{ rows }`);
  `neonFetchOverPostgres(url: string): typeof fetch` (answers Neon's SQL-over-HTTP requests from a local Postgres,
  so the real neon-http driver runs in tests).

- [ ] Write `http.db.test.ts`: the same select (text, int, bool, timestamptz, jsonb, null) through `createDb` and
      through `createHttpDb(url, { fetch: neonFetchOverPostgres(url) })` returns equal rows via `rowsOf`; an insert
      then select round-trips; `readerStatus(db, id)` gives the same answer on both.
- [ ] Run `pnpm --filter @astro/db test:db -- http` → FAIL (`createHttpDb` not defined).
- [ ] Implement `createHttpDb` (`neon(url, { fetchFunction })` → `drizzle({ client, schema })`), `rowsOf`, the fake
      (POST body `{ query, params }` → postgres.js `unsafe(query, params)`; reply `{ fields: [{ name, dataTypeID }], rows, rowCount, command }` with rows as objects).
- [ ] Switch `readerStatus` and the Today path's `execute()` reads to `rowsOf`.
- [ ] Run the db tests and `pnpm --filter @astro/app test` → PASS. Commit.

### Task 2: The pass

**Files:** Create `packages/server/src/pass.ts`, export from `index.ts`; Test `packages/server/test/pass.test.ts`

**Interfaces:**
- Produces: `interface Pass { uid: string; sid: string; th: string; reader: boolean; exp: number }`;
  `signPass(p: Omit<Pass, "th" | "exp">, sessionToken: string, secret: string, now?: number): Promise<string>`;
  `readPass(cookie: string | undefined, sessionToken: string | undefined, secret: string, now?: number): Promise<Pass | null>`;
  `PASS_TTL_S = 300`.

- [ ] Tests: round trip; expired at `now + 301 s` → null; one flipped character → null; other secret → null; other
      session token → null; garbage / empty / non-JSON / missing fields → null, never throws; `exp` is `now + 300`.
- [ ] Run → FAIL. Implement (`base64url(JSON).base64url(HMAC)`, constant-time verify via `crypto.subtle.verify`). Run → PASS. Commit.

### Task 3: One-query session lookup

**Files:** Create `apps/api/src/session.ts`; Test `apps/api/test/session.db.test.ts`

**Interfaces:**
- Consumes: `Db`, `rowsOf` (Task 1); `acceptSession` (`@astro/server`).
- Produces: `sessionToken(cookieHeader: string | null): string | null` (reads `astro.session_token`, verifies Better
  Auth's HMAC signature with `BETTER_AUTH_SECRET`); `lookupSession(db: Db, token: string): Promise<{ uid, sid, reader, timeZone } | null>`
  — one query: session ⨝ user, `surface='app'`, `expires_at > now()`, `disabled_at is null`, reader role active.

- [ ] Tests on both drivers: valid → row; expired, portal surface, disabled user, unknown token → null; a cookie
      with a bad signature → `sessionToken` null.
- [ ] Run → FAIL. Implement. Run → PASS. Commit.

### Task 4: The data Worker

**Files:** Create `apps/api/` (`package.json`, `wrangler.jsonc`, `tsconfig.json`, `vitest.config.ts`,
`src/index.ts`, `src/env.ts`, `src/today.ts`); Test `apps/api/test/routes.db.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `findToday`, `dueCheckIns`, `listReadings`, `readerStatus` from `apps/app/lib`
  (imported by relative path for Stage 0 only; they move to a shared package in Stage 1).
- Produces: `GET /api/v2/health` → `{ ok: true }`; `GET /api/v2/me` → `{ user: { id, reader } | null }`;
  `GET /api/v2/today` → `{ one, three, due, recent, reader }` (the same values Today renders now) or 401.
  Response header `x-astro-pass: hit | refresh` (for reading the logs).
- `wrangler.jsonc`: name `astro-api`, `main: src/index.ts`, `nodejs_compat`, `workers_dev: false`,
  `preview_urls: false`, route `{ pattern: "astroapp.midnightpoetry.studio/api/v2/*", zone_name: "midnightpoetry.studio" }`,
  observability on, vars `APP_URL`; secrets `DATABASE_URL`, `BETTER_AUTH_SECRET`, `PASS_SECRET` (documented, not committed).

- [ ] Tests (Hono `app.request` with the fake fetch): signed out → 401 and no pass; valid session → 200, sets
      `astro.pass` with the attributes above, `x-astro-pass: refresh`; second call with the pass → `hit`, no
      database read for the session (counted through the fake); pass for another session → refresh path; disabled
      user with a live pass → refused once the pass expires (time injected); `POST` → 405; security headers and
      `no-store` present; `/today` matches what `findToday`/`listReadings`/`dueCheckIns` return on postgres.js.
- [ ] Run → FAIL. Implement. Run → PASS. Lint, typecheck. Commit.

### Task 5: CPU budget check

**Files:** Create `apps/api/scripts/cpu-budget.mjs`, `apps/api/test/cpu-budget.test.ts` (runs it), add
`pnpm --filter @astro/api cpu` to the PR checks.

**Interfaces:** `cpu-budget.mjs --budget <ms> <path>...`: starts `wrangler dev` with the inspector, creates a test
session, calls each path 6 times, profiles each call over the DevTools protocol, exits non-zero if the median of
the warm calls exceeds the budget. Budget starts at measured local baseline + 50%.

- [ ] Test: a route that spins for 30 ms (test-only Worker entry) fails the check; `/api/v2/me` and
      `/api/v2/today` pass. Run → FAIL first (script missing), then PASS. Commit.

### Task 6: Deployment steps and the live measurement

**Files:** Modify `docs/DEPLOYMENT.md` (new section "Stage 0: astro-api measurement Worker").

- [ ] Browser-only steps: Workers & Pages → Create → Import a repository → `sxingxian/astro`, root
      `apps/api`, build `pnpm install --frozen-lockfile && pnpm --filter @astro/api build`, deploy
      `pnpm --filter @astro/api deploy`; Settings → Variables and Secrets: `DATABASE_URL` (Neon → astro_web
      connection string, pooled host), `BETTER_AUTH_SECRET` (same value as astro-app), `PASS_SECRET` (new, 32+
      characters). Then sign in to the app and open `/api/v2/today` a few times.
- [ ] Read CPU per request in Cloudflare (Observability → events, `x-astro-pass` hit vs refresh) and record the
      numbers in the spec. Gate: median for `hit` and `/today` under 6 ms → Stage 1; otherwise stop and report.
- [ ] PR, full suites green; merge only on "merge".
