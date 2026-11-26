# Admin Portal Implementation Plan (Plan 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** the owner runs Astro day to day without a developer. They can:

- edit any wording (landing page, app, emails, card meanings);
- set up three AI roles (writer and two checkers, each with fallbacks) with encrypted keys;
- change settings, help users, and invite people;

all from an invite-only admin portal at `astro.midnightpoetry.studio/admin`.

**Architecture:**

- A third Next.js 16 app (`apps/admin`) runs on OpenNext as the Worker `astro-admin`. It's on the route `astro.midnightpoetry.studio/admin*`, which takes precedence over the landing page's custom domain on the same hostname.
- It shares accounts with the app through a second Better Auth instance. Sessions record their surface (`app` or `admin`), and each Worker accepts only its own.
- Server code both Workers need moves into a new package, `@astro/server`.
- **Text:**
  - Wording lives in a new catalogue package, `@astro/copy`. The text in the code is the default, and the database stores overrides and published versions.
  - The app reads published wording live.
  - The landing page stays pure static files: publishing landing text calls a Workers Builds Deploy Hook. The landing build then fetches the published wording from a public app endpoint and builds it into the pages.
- **AI keys** are AES-256-GCM encrypted under a Worker secret.

**Tech Stack:** Next.js 16.4, @opennextjs/cloudflare 1.20, Wrangler 4.168, drizzle-orm 0.45, postgres 4.1, better-auth 1.7, Resend 6, Zod 4, Vitest 5, Playwright 1.65, `otpauth` (tests only). No new runtime dependencies beyond the workspace packages: TOTP verification and AES-GCM use WebCrypto.

**Spec:** `docs/spec/2026-11-26-admin-portal-design.md` (approved 26 Nov). It builds on `docs/spec/2026-11-24-astro-design.md`. Mockups: https://claude.ai/artifact/BFRgaSVWbDGULjyxKX9gC9, page "Admin", section "Plan 3 · Admin portal". Deployment: `docs/DEPLOYMENT.md`.

**Delivery:** two pull requests, each green and mergeable on its own:

- **Part A**, tasks A1–A10, on branch `feat/admin-portal`;
- **Part B**, tasks B1–B6, on branch `feat/admin-text`, cut from `main` after Part A merges.

## Global Constraints

- **Hosting:** Workers Free.
  - The landing page must stay pure static files. No Worker script on `astro-landing`, no `run_worker_first`.
  - No new KV, Durable Objects or Queues.
  - 10 ms CPU per request: no hashing or crypto loops on the Worker beyond single AES-GCM, HMAC or SHA-256 calls.
- **Deploy:** every new Cloudflare piece must be creatable in the dashboard and documented in `docs/DEPLOYMENT.md` as browser steps. GitHub holds no secrets. Workers Builds runs deploys; only `astro-app` runs migrations.
- **Database:**
  - Migrations are expand-then-contract.
  - Runtime roles: `astro_web` (app) and the new `astro_admin` (portal), with no DDL.
  - `audit_log` allows `INSERT` only for both runtime roles, and a trigger rejects `UPDATE` and `DELETE`.
- **Roles** (design §2): `owner`, `admin`, `moderator` (portal) and `reader` (app). One active role per person and exactly one owner. Invites are SHA-256-hashed tokens valid for 72 h.
- **Staff security:**
  - Cloudflare Access is the first gate.
  - Only accounts with an active portal role can sign in to the portal; anyone else gets the same error as a wrong password.
  - An authenticator is required.
  - Sessions last 8 h.
  - Step-up (a fresh TOTP code, single use, at most 5 tries per 15 min) is required for:
    - AI service and key changes;
    - inviting, changing roles and removing people;
    - disabling a user and resetting their 2-step;
    - publishing card meanings;
    - restoring a version.
- **AI keys:**
  - AES-256-GCM with a random 96-bit IV, and `ai_service.id` as associated data. The master key is the Worker secret `AI_KEY_ENCRYPTION_KEY` (64 hex characters).
  - Never returned to a browser, logged, or written to the audit log; only `key_last4` is shown.
  - Every key change emails the owner.
- **AI roles:**
  - `writer`, `checker_1` and `checker_2`, each with a main service plus at least 2 fallbacks.
  - Each reading uses three different companies.
  - A failing service cools down for 10 minutes.
  - Base URLs: `https://` with a hostname (no IP address) only.
- **Text:**
  - Plain text only, rendered escaped (React text nodes; never `dangerouslySetInnerHTML`).
  - Each override passes its catalogue entry's maximum length and keeps exactly the default's placeholders.
  - Landing publishes are limited to one per 2 minutes.
  - A landing build fails rather than silently using defaults when the published wording can't be fetched.
- **Security headers:** nonce CSP with `frame-ancestors 'none'`, HSTS, `nosniff`, Referrer-Policy `strict-origin-when-cross-origin`, Permissions-Policy; the portal adds `X-Robots-Tag: noindex`. Every state-changing route has Zod plus a same-origin check against `ADMIN_URL`.
- **Privacy:** no portal screen or API returns journal notes, check-in notes or reading contents. Users are found by exact email only.
- **Design:**
  - The admin style from the mockups (Night/Ink, gold hairlines, Inter with Cormorant headings, 8 px grid).
  - WCAG 2.2 AA, touch targets of at least 44 px, works at 360 px wide.
  - Transitions of 300 ms or less, and reduced motion respected.

## Review Focus

1. **Privilege escalation:**
   - a moderator or admin calling an owner-only route directly;
   - an admin granting `admin` or `owner`;
   - a reader or plain user reaching any portal route.

   Every route handler checks `can(role, action)` on the server. Covered in A5: a test sends every portal mutation with each role's session.
2. **Session confusion:**
   - an app session cookie replayed against the portal, or the other way round;
   - a disabled user, or someone whose role was removed, keeping a live session.

   Covered in A2 and A4.
3. **AI key leakage:**
   - the key in any page, API response, log line, audit summary or provider error echo;
   - a ciphertext copied into another row.

   Covered in A9: a redaction test, an AAD-mismatch test, and an HTML scan for the plaintext.
4. **The landing page silently reverting wording:**
   - a build that runs while the app endpoint is down, slow or returns malformed data;
   - HTML or script typed into a text field.

   Covered in B2.
5. **Step-up replay or brute force:** the same TOTP code reused for a second sensitive action in the same 30-second window, or guessed repeatedly. Covered in A4.

---

## File map

```
packages/server/            @astro/server (new): code both Workers share
  src/password-hash.ts      moved from apps/app/lib
  src/mail.ts               moved: drivers (resend, outbox)
  src/csp.ts, origin.ts, http.ts   moved; origin takes the allowed origin as an argument
  src/auth-base.ts          buildAuthOptions(env, deps, surface): shared Better Auth options
  src/totp.ts               verifyTotp(secret, code, at): WebCrypto HMAC-SHA1, RFC 6238
  src/step-up.ts            requireStepUp(db, user, code, now)
  src/roles.ts              Role, Action, can(role, action): the access matrix
  src/audit.ts              audit(db, entry)
  src/ai/crypto.ts          encryptKey / decryptKey (AES-256-GCM)
  src/ai/roles.ts           validateRoles, pickServices
  src/ai/providers.ts       testService adapters (anthropic, openai, gemini, openai_compatible)
packages/copy/              @astro/copy (new, Part B): catalogue, validateOverride, types
packages/db/                schema.ts + migrations 0003_admin (Part A), 0004_text (Part B)
apps/admin/                 the portal (new): app/ routes, components/, lib/, e2e/
apps/app/                   imports @astro/server; invite acceptance; maintenance mode; copy (Part B)
apps/landing/               scripts/fetch-copy.mjs; components read the built copy (Part B)
docs/DEPLOYMENT.md          new browser steps
```

---

## Part A: portal foundations (`feat/admin-portal`)

### Task A1: Shared server package `@astro/server`

**Files:**
- Create: `packages/server/{package.json,tsconfig.json,src/index.ts}`, and move `password-hash.ts`, `mail.ts`, `csp.ts`, `origin.ts` and `http.ts` from `apps/app/lib` into `packages/server/src`.
- Modify: `apps/app/lib/*` imports, `apps/app/lib/auth-options.ts`.
- Test: move the matching tests into `packages/server/test`; `apps/app/test/auth-config.test.ts` stays.

**Interfaces:**
- Produces:
  - `buildAuthOptions(env: BaseAuthEnv, deps: AuthDeps, surface: { name: "app" | "admin"; baseURL: string; basePath: string; cookiePrefix: string; sessionHours: number }): BetterAuthOptions`;
  - `assertSameOrigin(request: Request, allowed: string): void`;
  - `createMailer`, `createPasswordHasher` and `buildCsp`, with their current signatures.
- The app's `authOptions(env, deps)` becomes a thin call: `buildAuthOptions(..., { name: "app", basePath: "/api/auth", cookiePrefix: "astro", sessionHours: 24 * 7 })`. Its disabled paths and hooks stay.

- [ ] **Step 1:** Move the code and its tests. Run `pnpm --filter @astro/server test`. Expected: PASS, with the same counts as before the move.
- [ ] **Step 2:** Add `packages/server/test/auth-base.test.ts`:
  - `buildAuthOptions(env, deps, admin)` gives `basePath "/api/auth"` under `baseURL ".../admin"`, the cookie prefix `"astro-admin"` and `session.expiresIn === 8 * 3600`;
  - the app surface gives the prefix `"astro"`.
  - Run it. Expected: FAIL.
- [ ] **Step 3:** Implement `buildAuthOptions`, carrying over:
  - password hashing;
  - email rules;
  - two-factor, captcha and HIBP;
  - database rate limits;
  - `cf-connecting-ip`;
  - secure cookies.
- [ ] **Step 4:** Run `pnpm test && pnpm --filter @astro/app e2e`. Expected: PASS, and the app behaves the same.
- [ ] **Step 5:** Commit `refactor: move shared server code into @astro/server`.

### Task A2: Database for the portal (`0003_admin`)

**Files:**
- Modify: `packages/db/src/schema.ts`.
- Create: `packages/db/migrations/0003_admin.sql` (generated, plus hand-written grants and trigger).
- Test: `packages/db/test/admin.db.test.ts`.

**Interfaces:**
- **New tables:**
  - `staff_role(user_id pk → user, role text check in (owner, admin, moderator, reader), granted_by, granted_at, revoked_at)`, with the unique partial index `one_owner on staff_role((true)) where role='owner' and revoked_at is null`;
  - `invite(id uuid, email citext, role, token_hash bytea unique, invited_by, created_at, expires_at, accepted_at, revoked_at)`;
  - `audit_log(id bigserial, actor_id, actor_role, action text, entity text, entity_id text, summary jsonb, ip_hash text, at timestamptz default now())`;
  - `ai_service(id uuid, provider text check in (anthropic, openai, gemini, openai_compatible), name, company, base_url null, model, key_ciphertext bytea, key_iv bytea, key_last4 text, enabled bool, max_tokens int, temperature real, timeout_ms int, last_test_at, last_test_ok bool, cooldown_until timestamptz null, updated_by, updated_at)`;
  - `ai_role_slot(role text check in (writer, checker_1, checker_2), position smallint, service_id → ai_service, primary key (role, position))`.
- **New columns:**
  - `session.surface text not null default 'app'`;
  - `user.disabled_at timestamptz null`.
- **New `app_setting` seeds:**
  - `ai_daily_cap_usd` = `"20.00"`;
  - `ai_per_person_per_day` = `5`;
  - `maintenance_mode` = `false`;
  - `contact_email` and `social_links`, empty.
- **Grants:**
  - A `DO` block runs when the roles exist (same pattern as `0001`).
  - `astro_admin`:
    - `SELECT, INSERT, UPDATE, DELETE` on `staff_role`, `invite`, `ai_service`, `ai_role_slot` and `app_setting`;
    - `SELECT` on `draw_session` (dashboard counts only);
    - for staff sign-in, invite sign-up and 2-step enrolment through its Better Auth instance:
      - `SELECT, INSERT` on `user` and `account`;
      - `UPDATE (name, email_verified, two_factor_enabled, disabled_at, updated_at)` on `user`;
      - `SELECT, INSERT, UPDATE, DELETE` on `session`, `verification` and `two_factor`;
    - `INSERT` on `audit_log` and `mail_outbox`, and `SELECT, INSERT, UPDATE` on `rate_limit`.
  - `astro_admin` never gets `UPDATE (email)` on `user` or any password column.
  - `astro_web`:
    - `SELECT` on `staff_role`, `invite`, `ai_service` and `ai_role_slot`;
    - `UPDATE (accepted_at)` on `invite`;
    - `INSERT` on `staff_role` (only through the acceptance service) and `INSERT` on `audit_log`.
- **Trigger** `audit_log_append_only` raises an error on `UPDATE` or `DELETE`.

- [ ] **Step 1:** Write `admin.db.test.ts`, run as each role through `testing.ts`:
  - inserting a second active owner fails with a unique violation;
  - `astro_admin` `UPDATE audit_log` fails (permission), and `migrator` `DELETE FROM audit_log` fails (trigger);
  - `astro_admin` `CREATE TABLE x()` fails;
  - `astro_web` can `SELECT key_last4 FROM ai_service` but can't `UPDATE ai_service`;
  - `astro_admin` can `UPDATE "user" SET disabled_at` but can't `UPDATE "user" SET email`, and can't `SELECT` `reading_note` or `check_in`;
  - the new `session.surface` defaults to `'app'`.
- [ ] **Step 2:** Run `pnpm --filter @astro/db test:db`. Expected: FAIL.
- [ ] **Step 3:** Implement the schema, generate the migration, and add the grants, trigger and seeds by hand.
- [ ] **Step 4:** Run `pnpm db:test`. Expected: PASS. Also confirm `0002` and earlier are untouched.
- [ ] **Step 5:** Update CI to create the `astro_admin` role next to `astro_web`. Commit `feat(db): staff roles, invites, audit log and AI services`.

### Task A3: Portal scaffold (`apps/admin`)

**Files:**
- Create:
  - `apps/admin/{package.json,next.config.ts,open-next.config.ts,wrangler.jsonc,tsconfig.json,eslint.config.js,vitest.config.ts,playwright.config.ts}`;
  - `proxy.ts`;
  - `lib/env.ts`, `lib/db.ts`;
  - `app/layout.tsx`, `app/(portal)/layout.tsx` (sidebar from the mockups), `app/api/health/route.ts`;
  - `.dev.vars.example`.
- Modify: the root `package.json` scripts (`cf:build:admin`, `cf:deploy:admin`) and `turbo.json`.
- Test: `apps/admin/test/env.test.ts`, `apps/admin/e2e/headers.spec.ts`.

**Interfaces:**
- **`wrangler.jsonc`:**
  - `name "astro-admin"`;
  - `workers_dev false`, `preview_urls false`;
  - `routes [{ pattern: "astro.midnightpoetry.studio/admin*", zone_name: "midnightpoetry.studio" }]`;
  - the Hyperdrive binding `HYPERDRIVE` (the id is filled in after the owner creates `astro-admin`; a placeholder until then);
  - vars `ADMIN_URL "https://astro.midnightpoetry.studio/admin"`, `APP_URL`, `EMAIL_FROM`, `PUBLIC_TURNSTILE_SITE_KEY`, `AI_GATEWAY_URL`, `OWNER_ALERTS "on"`.
- **Next config:** `basePath: "/admin"`.
- **`parseEnv`:**
  - requires `BETTER_AUTH_SECRET` (min 32), `AI_KEY_ENCRYPTION_KEY` (`/^[0-9a-f]{64}$/`) and `TURNSTILE_SECRET_KEY`;
  - `RESEND_API_KEY` is required on the production address;
  - `LANDING_DEPLOY_HOOK_URL` is optional in Part A;
  - it refuses outbox mail or Turnstile off when `ADMIN_URL` starts with `https://astro.midnightpoetry.studio`.

- [ ] **Step 1:** Write `env.test.ts`:
  - production `ADMIN_URL` with `MAIL_DRIVER=outbox` throws;
  - a 63-character key throws;
  - development values parse.

  Write `headers.spec.ts`: `/admin/sign-in` returns a CSP with `nonce-` and `frame-ancestors 'none'`, plus `X-Robots-Tag: noindex`, HSTS and `nosniff`; `/admin/api/health` returns `{ ok: true }`.
- [ ] **Step 2:** Run `pnpm --filter @astro/admin test && pnpm --filter @astro/admin e2e headers`. Expected: FAIL.
- [ ] **Step 3:** Scaffold as in the app (OpenNext, proxy nonce CSP reusing `buildCsp`). The local preview is `wrangler dev --port 8791`.
- [ ] **Step 4:** Run the commands from Step 2. Expected: PASS. `pnpm --filter @astro/admin exec wrangler deploy --dry-run` shows the route and the Hyperdrive binding.
- [ ] **Step 5:** Commit `feat(admin): portal scaffold on astro.midnightpoetry.studio/admin`.

### Task A4: Staff sign-in, session surfaces, 2-step and step-up

**Files:**
- Create:
  - `packages/server/src/{totp.ts,step-up.ts}`;
  - `apps/admin/lib/{auth.ts,staff.ts}`, `apps/admin/app/api/auth/[...all]/route.ts`;
  - `app/sign-in/page.tsx` (mockup "P3 · Admin sign-in"), `app/setup-2fa/page.tsx`;
  - `components/StepUpDialog.tsx`.
- Modify: `apps/app/lib/auth.ts` and `apps/app/lib/auth-options.ts` (surface and disabled-user checks).
- Test: `packages/server/test/{totp.test.ts,step-up.db.test.ts}`, `apps/admin/e2e/sign-in.spec.ts`, `apps/app/test/session-surface.db.test.ts`.

**Interfaces:**
- **TOTP:**
  - `verifyTotp(secretBase32: string, code: string, at: Date): Promise<number | null>` returns the matched time step (±1 step) or null;
  - `decryptTwoFactorSecret(stored: string, authSecret: string): Promise<string>` uses Better Auth's `symmetricDecrypt` from `better-auth/crypto`.
- **Step-up:** `requireStepUp(db, userId, code, now): Promise<void>`.
  - It throws `StepUpFailed` after 5 tries in 15 minutes (the `rate_limit` key `astro-stepup:${id}`).
  - A step that's already been used is rejected: the last used step is stored in the `rate_limit` key `astro-totp-step:${id}`.
- **Staff helpers:**
  - `getStaff(headers): Promise<{ id, email, role, twoFactorEnabled } | null>` accepts only `session.surface='admin'`, a non-disabled user and an active portal role;
  - `requireStaff(headers, action: Action)` throws 403 when `!can(role, action)`.
- **Surfaces:**
  - Each instance's `databaseHooks.session.create.before` sets `surface` and refuses disabled users.
  - Its `hooks.before` on `/sign-in/email` (admin only) returns the generic "That email or password isn't right." when the email has no active portal role.
  - The app's `getSessionUser` rejects sessions whose `surface` isn't `'app'`, and disabled users.

- [ ] **Step 1:** Write the tests:
  - **`totp.test.ts`:**
    - the RFC 6238 SHA-1 test vector (`"12345678901234567890"` at 59 s gives `287082` for 6 digits);
    - ±1 step accepted, ±2 rejected;
    - a non-digit code returns null.
  - **`step-up.db.test.ts`:**
    - the right code passes;
    - the same code again within its step throws;
    - 5 wrong codes, then a right one, throws `StepUpFailed`.
  - **`session-surface.db.test.ts`:**
    - an admin-surface session token gets null from the app's `getSessionUser`;
    - a disabled user's app session gets null.
  - **`sign-in.spec.ts`** (outbox mail, with a seeded owner, and a plain user created by the app's sign-up):
    - the plain user sees the generic error;
    - the owner without 2-step lands on `/admin/setup-2fa` and every other page redirects there;
    - after enrolling, `/admin` loads;
    - the app's session cookie, sent to `/admin`, redirects to sign-in.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the code above. The admin sign-in uses Turnstile like the app. `/admin/setup-2fa` reuses the app's TOTP setup component pattern.
- [ ] **Step 4:** Run `pnpm test && pnpm db:test && pnpm e2e`. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): staff-only sign-in, session surfaces, required 2-step and step-up codes`.

### Task A5: Roles, invitations and Team

**Files:**
- Create:
  - `packages/server/src/roles.ts`, `apps/admin/lib/team.ts`;
  - `apps/admin/app/(portal)/team/page.tsx` (mockup "P3 · Team and roles");
  - `apps/admin/app/api/team/{invite,revoke,role,remove}/route.ts`;
  - `apps/admin/app/invite/[token]/page.tsx`;
  - `apps/app/app/invite/[token]/page.tsx`, `apps/app/lib/invite.ts` (mockup "P3 · Accept invite").
- Test: `packages/server/test/roles.test.ts`, `apps/admin/test/team.db.test.ts`, `apps/admin/e2e/{invite.spec.ts,permissions.spec.ts}`.

**Interfaces:**
- **Roles:**
  - `type Role = "owner" | "admin" | "moderator" | "reader"`;
  - `type Action = "text.edit" | "text.publish" | "meanings.edit" | "meanings.publish" | "settings.edit" | "ai.edit" | "team.invite" | "team.manage" | "users.help" | "audit.view" | "dashboard.view"`;
  - `can(role, action): boolean`, exactly the matrix in design §2;
  - `canGrant(actor: Role, target: Role): boolean` (owner: admin, moderator, reader; admin: moderator, reader).
- **Team service:**
  - `createInvite(db, actor, { email, role }, now): Promise<{ link }>` makes 32 random bytes, base64url encoded, and stores the SHA-256. Staff links go to `${ADMIN_URL}/invite/<token>`, reader links to `${APP_URL}/invite/<token>`. It sends mail and writes to the audit log.
  - An invitee with no account sets a password on the invite page. The admin instance's `/sign-up/email` is disabled except when the request carries a valid, unexpired invite token for that same email, checked in `hooks.before`. Turnstile and the password rules still apply, and the email counts as verified because the link proves it.
  - `acceptInvite(db, token, user, now)` checks:
    - the token hash matches, it isn't expired, accepted or revoked;
    - the signed-in email equals the invite email;
    - `user.twoFactorEnabled` is true.

    It then inserts `staff_role` and sets `accepted_at`, in one transaction.
  - `revokeInvite`.
  - `changeRole` and `removeRole` delete that person's admin-surface sessions. The owner can't be changed or removed.

- [ ] **Step 1:** Write the tests:
  - **`roles.test.ts`:** a table test over every role × action, against the design matrix. `canGrant("admin","admin")` is false, and `canGrant(x,"owner")` is false for every x.
  - **`team.db.test.ts`:**
    - an invite token works once;
    - an expired token fails;
    - an email mismatch fails;
    - without 2-step it fails with `"two_step_required"`;
    - an admin inviting an admin fails;
    - admin `/sign-up/email` without a token, or with a token for another email, is refused;
    - removing a moderator deletes their admin sessions;
    - removing the owner fails.
  - **`invite.spec.ts`:** the owner invites a reader (step-up code from `otpauth`). The reader opens the outbox link in the app, signs up, enrols TOTP and accepts. `staff_role` shows `reader`, and the Team list shows them as Active.
  - **`permissions.spec.ts`:** with seeded sessions for moderator, admin and reader, POST every `/admin/api/*` mutation. A moderator gets 403 except the `users.*` routes; an admin gets 403 on `ai/*`, `meanings/publish` and on granting admin; a reader is redirected to sign-in.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the code above, plus the Team screen from the mockup.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): roles, invite-only staff and readers, Team screen`.

### Task A6: Audit log

**Files:**
- Create: `packages/server/src/audit.ts`, `apps/admin/app/(portal)/audit/page.tsx` (mockup "P3 · Audit log"), `apps/admin/app/api/audit/export/route.ts`.
- Test: `packages/server/test/audit.db.test.ts`, `apps/admin/e2e/audit.spec.ts`.

**Interfaces:**
- `audit(db, { actorId, actorRole, action, entity, entityId?, summary, ip? })`. It stores `ip_hash = sha256(ip + BETTER_AUTH_SECRET)` truncated to 16 hex characters.
- `summary` is validated against an allowlist of keys per action, so free text and secrets can't get in.
- `listAudit(db, { actorId?, actions?, from?, to?, cursor? })` pages 50 entries at a time.
- The CSV export is limited to 10,000 rows and needs `audit.view`.

- [ ] **Step 1:** Write the tests:
  - **`audit.db.test.ts`:** a summary with a non-allowlisted key, for example `key`, throws; filters by actor and date work.
  - **`audit.spec.ts`:** sign-in, invite and role change show up in the Audit screen; a moderator can't open `/admin/audit` (403 page).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it, and call `audit` from every A4–A9 mutation, including sign-in.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): append-only audit log with filters and export`.

### Task A7: Users

**Files:**
- Create: `apps/admin/lib/users.ts`, `app/(portal)/users/page.tsx` (mockup "P3 · Users"), `app/api/users/{disable,enable,reset-2fa}/route.ts`.
- Test: `apps/admin/test/users.db.test.ts`, `apps/admin/e2e/users.spec.ts`.

**Interfaces:**
- `findUser(db, email)` does an exact, case-insensitive match. It returns `{ id, email, createdAt, emailVerified, twoFactorEnabled, lastSignInAt, readingCount, disabledAt }` and nothing else.
- `disableUser` sets `disabled_at` and deletes all their sessions. `enableUser` clears it.
- `resetTwoStep` deletes the `two_factor` row, sets `twoFactorEnabled=false` and deletes their sessions.
- All three need `users.help` and step-up. Staff accounts can only be disabled by the owner.

- [ ] **Step 1:** Write the tests:
  - **`users.db.test.ts`:**
    - the returned object's keys are exactly those listed above, with no notes;
    - a partial email returns null;
    - disabling deletes the sessions;
    - a moderator disabling an admin fails.
  - **`users.spec.ts`:**
    - a moderator finds a user, disables them with a step-up code, and the user's app session ends: their next request redirects to sign-in, and signing in fails;
    - re-enabling restores sign-in.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it, with the step-up dialog from the mockup.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): find a user, disable and reset 2-step`.

### Task A8: Site settings, maintenance mode, Dashboard

**Files:**
- Create:
  - `packages/server/src/settings.ts`;
  - `apps/admin/app/(portal)/settings/page.tsx` (the existing mockup "Admin · Site settings", with the Plan 3 menu);
  - `app/(portal)/page.tsx` (Dashboard; existing mockup);
  - `app/api/settings/route.ts`;
  - `apps/app/lib/maintenance.ts`, `apps/app/app/maintenance/page.tsx`.
- Modify: `apps/app/proxy.ts`.
- Test: `packages/server/test/settings.test.ts`, `apps/admin/e2e/settings.spec.ts`, `apps/app/e2e/maintenance.spec.ts`.

**Interfaces:**
- `SETTINGS`: a registry of `{ key, schema: ZodType, default, action: Action }` covering:
  - `reversal_rate` (0–1);
  - `guest_daily_cap` (1–20);
  - `maintenance_mode`;
  - `contact_email`;
  - `social_links` (https URLs, up to 6);
  - `disclaimer_note`;
  - `ai_daily_cap_usd`;
  - `ai_per_person_per_day`.
- `getSetting(db, key)` and `setSetting(db, actor, key, value)` validate and write to the audit log.
- In the app, `isMaintenance()` is cached for 60 s. When it's on, every page except `/maintenance` and `/api/health` returns the maintenance page with status 503.
- Dashboard counts come from SQL aggregates: sign-ups, readings by spread, active users (with a draw today), and check-ins answered, for today and 7 days. Plus a link to Cloudflare's Workers analytics.

- [ ] **Step 1:** Write the tests:
  - **`settings.test.ts`:** `reversal_rate` 1.5 is rejected, and an `http://` social link is rejected.
  - **`settings.spec.ts`:** an admin changes the guest daily cap and it's audited; a moderator can't open Settings.
  - **`maintenance.spec.ts`:** with maintenance on, `/today` returns 503 with the maintenance copy and `/api/health` returns 200.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it, and swap the app's hard-coded guest cap and reversal rate reads for `getSetting`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): site settings, maintenance mode and dashboard`.

### Task A9: AI services, roles, fallbacks and encrypted keys

**Files:**
- Create:
  - `packages/server/src/ai/{crypto.ts,roles.ts,providers.ts}`;
  - `apps/admin/lib/ai.ts`;
  - `app/(portal)/ai/page.tsx` (mockup "P3 · AI settings");
  - `app/api/ai/{service,key,roles,test}/route.ts`.
- Test: `packages/server/test/ai-crypto.test.ts`, `packages/server/test/ai-roles.test.ts`, `packages/server/test/ai-providers.test.ts`, `apps/admin/e2e/ai.spec.ts`.

**Interfaces:**
- **Crypto:**
  - `encryptKey(masterHex: string, plaintext: string, aad: string): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }>`;
  - `decryptKey(masterHex, { ciphertext, iv }, aad): Promise<string>`.
- **Roles:**
  - `type Slot = { role: "writer" | "checker_1" | "checker_2"; position: number; serviceId: string }`;
  - `validateRoles(slots, services): { ok: boolean; errors: string[]; warnings: string[] }`.
    - Errors: a role with fewer than 3 slots; a slot whose service is disabled or not tested OK; fewer than 3 distinct companies across all slots.
    - Warning: exactly 3 distinct companies (fragile).
  - `pickServices(slots, services, now): { writer, checker_1, checker_2 } | null`. Each role takes its first service that is enabled, not cooling down, and from a company not already chosen. It returns null when any role runs out. Order of choice: writer, then checker_1, then checker_2.
- **Providers:**
  - `testService(service, key, fetchFn, gatewayUrl): Promise<{ ok: boolean; ms: number; error?: string }>`;
  - one adapter per provider sends a one-line prompt and a max of 5 tokens;
  - `anthropic`, `openai` and `gemini` go through `${AI_GATEWAY_URL}/<provider>`, and `openai_compatible` calls `base_url` directly;
  - `redact(text, key)` replaces the key and any 8+ character substring of it with `[redacted]`;
  - `classifyFailure(status, body): "timeout" | "server" | "quota" | "auth" | "other"` (402/429/"insufficient_quota" → `quota`; 401/403 → `auth`).
- **Admin service:**
  - `saveService` needs owner and step-up for key changes. `validateBaseUrl` rejects non-https, IP hosts, `localhost` and ports other than 443.
  - Every key change emails the owner (`email.ai_key_changed`, sent with the existing mailer) and writes to the audit log (`{ serviceId, provider, last4 }`).
  - Tests are limited to 10 per hour per owner. `saveRoles` checks with `validateRoles`.

- [ ] **Step 1:** Write the tests:
  - **`ai-crypto.test.ts`:**
    - round trip;
    - decrypting with another `aad` (row id) throws;
    - decrypting with another master key throws;
    - two encryptions of the same plaintext give different IVs and ciphertexts.
  - **`ai-roles.test.ts`:**
    - **`validateRoles`:**
      - a role with 2 slots gives an error;
      - 3 companies gives the warning `"fragile"`;
      - 5 companies with every service tested is OK.
    - **`pickServices`:**
      - when the writer's main is Anthropic and checker_1's main is also Anthropic, checker_1 falls to its first non-Anthropic fallback;
      - a service in cooldown is skipped;
      - all of checker_2's fallbacks being companies already used returns null.
  - **`ai-providers.test.ts`:**
    - with a mocked fetch, each adapter sends the right URL, headers and body (the key in a header, never in the URL for openai, anthropic and openai_compatible);
    - an error body echoing the key comes back with `[redacted]`;
    - `classifyFailure(429, …)` is `quota`.
  - **`ai.spec.ts`:**
    - the owner adds a service with a test key against a local stub (`AI_GATEWAY_URL` points to a test server). Saving asks for step-up;
    - after saving, the page HTML and every `/admin/api/ai/*` response contain `last4` but not the key;
    - roles with only 2 fallbacks can't be saved (the error is shown);
    - an admin opening `/admin/ai` gets 403;
    - an owner email is in `mail_outbox`.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it, with the screen built from the mockup (Ready banner, Roles, Services and keys, Writing, Limits).
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): AI services with encrypted keys, three roles with fallbacks, connection tests`.

### Task A10: Deployment steps, CI and roadmap (Part A)

**Files:**
- Modify: `docs/DEPLOYMENT.md`, `.github/workflows/ci.yml`, `docs/superpowers/plans/README.md`, `docs/spec/2026-11-24-astro-design.md` (AI line, roles line).

- [ ] **Step 1:** Add the browser steps to `DEPLOYMENT.md`:
  - **Neon SQL Editor:** `CREATE ROLE astro_admin LOGIN PASSWORD '…'`, plus a check query.
  - **Hyperdrive:** `astro-admin`, with caching off.
  - **Cloudflare Access:** the app on `astro.midnightpoetry.studio/admin*`, allowing staff emails, with an 8-hour session.
  - **`astro-admin` Worker:** imported from the repo.
    - Build: `pnpm install --frozen-lockfile && pnpm cf:build:admin`.
    - Deploy: `pnpm cf:deploy:admin`, with no migrations; `astro-app` migrates.
    - Watch paths: `apps/admin/*`, `packages/*`, the lock file.
    - Non-production builds off.
    - Secrets: `BETTER_AUTH_SECRET` (the same value as the app), `AI_KEY_ENCRYPTION_KEY` (new, 64 hex characters from the password manager), `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`.
  - **Order:** deploy `astro-app` first, so `0003` runs before the portal goes live.
  - **First owner:** sign up on the app, then run `insert into staff_role (user_id, role, granted_at) select id, 'owner', now() from "user" where email = '<your email>';` in Neon's SQL Editor. It works only once.
  - **New checks in step 15:** `/admin` is blocked in a private window, and the portal headers are present.
- [ ] **Step 2:** CI:
  - create the `astro_admin` role;
  - copy `apps/admin/.dev.vars.example`;
  - `pnpm e2e` covers the admin app (Playwright starts `wrangler dev --port 8791`).
- [ ] **Step 3:** Update the roadmap table: Plan 3 is the admin portal (Part A built), Plan 4 is paid readings, and Plan 5 is growth.
- [ ] **Step 4:** Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm db:test && pnpm e2e`. Expected: all PASS.
- [ ] **Step 5:** Commit `docs: admin portal deployment steps and roadmap`, push, and open the Part A pull request.

---

## Part B: text editing (`feat/admin-text`, after Part A merges)

### Task B1: The text catalogue `@astro/copy`

**Files:**
- Create: `packages/copy/{package.json,tsconfig.json,src/index.ts,src/types.ts,src/validate.ts,src/landing.ts,src/app.ts,src/email.ts}`.
- Test: `packages/copy/test/validate.test.ts`, `packages/copy/test/catalogue.test.ts`.

**Interfaces:**
- `type CopyEntry = { key: string; surface: "landing" | "app" | "email"; group: string; label: string; where: string; default: string; max: number; placeholders: readonly string[] }`.
- `catalogue: Record<CopyKey, CopyEntry>`, with `CopyKey` a string-literal union generated from the entries.
- `validateOverride(entry, value): { ok: true } | { ok: false; reason: "too_long" | "placeholders" | "control_chars" | "empty" }`. Line breaks are allowed; other control characters aren't.
- `resolve(entry, overrides): string`.
- `fill(text, values: Record<string,string>): string` replaces `{name}` placeholders.

- [ ] **Step 1:** Write the tests:
  - **`validate.test.ts`:**
    - over max gives `too_long`;
    - the default `"Hi {name}"` with value `"Hello"` gives `placeholders`;
    - `"Hello {name} {name}"` passes;
    - `"\u0007"` gives `control_chars`;
    - `"<b>x</b>"` passes validation, because output is always escaped.
  - **`catalogue.test.ts`:**
    - every key is unique and matches `/^(landing|app|email)\.[a-z0-9_.]+$/`;
    - every default passes its own validation;
    - every placeholder in a default is listed.
- [ ] **Step 2:** Run `pnpm --filter @astro/copy test`. Expected: FAIL.
- [ ] **Step 3:** Implement it. Seed `landing.ts` from `apps/landing/content/site.ts`, word for word.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(copy): text catalogue with defaults and validation`.

### Task B2: Landing page builds the published wording in

**Files:**
- Create: `apps/landing/scripts/fetch-copy.mjs`, `apps/landing/content/copy.ts`.
- Modify: `apps/landing/package.json` (`build`: `node scripts/fetch-copy.mjs && next build && node scripts/csp.mjs`), the components that read `content/site.ts`, and `Footer.tsx` (text version).
- Test: `apps/landing/test/fetch-copy.test.ts`, `apps/landing/e2e/copy.spec.ts`.

**Interfaces:**
- `fetch-copy.mjs`:
  - **Default:** reads `COPY_SOURCE_URL` (default `https://astroapp.midnightpoetry.studio/api/copy/landing`) with a 10 s timeout and validates `{ version: number, overrides: Record<string,string> }` with Zod.
  - **Overrides:** an unknown key is dropped with a warning; an override that fails validation fails the build.
  - **Output:** writes `content/published.json`.
  - **Exits 1 when:** there's a network error, a non-200 status (except 204, meaning nothing published, which gives `{ version: 0, overrides: {} }`), or an invalid body.
  - **`COPY_SOURCE=defaults`:** skips the fetch and writes version 0.
- `copy(key: LandingKey): string` reads `published.json` overrides over the catalogue defaults at build time.

- [ ] **Step 1:** Write the tests:
  - **`fetch-copy.test.ts`** (fetch injected):
    - a network error exits 1 and leaves the old `published.json` untouched;
    - 204 writes version 0;
    - a malformed body exits 1;
    - an override over max exits 1;
    - `COPY_SOURCE=defaults` makes no fetch.
  - **`copy.spec.ts`** (build with a fixture `published.json`):
    - the hero heading shows the override;
    - the footer shows `v7`;
    - an override containing `<script>alert(1)</script>` is shown as text and no script runs;
    - the CSP hashes still match (`csp.mjs` passes).
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it, and swap the components to `copy()`. `content/site.ts` keeps only non-text constants (links, card ids).
- [ ] **Step 4:** Run `pnpm --filter @astro/landing test && pnpm --filter @astro/landing e2e`. Expected: PASS, and every existing landing test still passes. CI sets `COPY_SOURCE=defaults`.
- [ ] **Step 5:** Commit `feat(landing): build published wording into the static page`.

### Task B3: App, email and card-meaning wording from the catalogue

**Files:**
- Modify:
  - every app component and page with visible text;
  - `apps/app/lib/patterns-copy.ts`;
  - `packages/server/src/mail.ts` templates;
  - the app's meanings readers.
- Create: `apps/app/lib/copy.ts`, `apps/app/lib/meanings.ts`.
- Test: `apps/app/test/copy.db.test.ts`, the existing app e2e.

**Interfaces:**
- `getCopy(): Promise<(key: AppKey | EmailKey, values?: Record<string,string>) => string>`:
  - reads the latest `text_version` of kind `app` (cached 60 s per isolate), or a preview snapshot when the request carries a valid `astro-preview` id;
  - server components call it, and client components receive strings as props.
- `getMeanings(): Promise<MeaningsTable>` overlays the latest `meanings` snapshot on the `@astro/meanings` defaults.

- [ ] **Step 1:** Write `copy.db.test.ts`:
  - with no versions, `t("app.today.title")` equals the catalogue default;
  - after inserting a version with an override it returns the override (cache bypassed in tests);
  - an expired preview id is ignored;
  - `getMeanings()` returns The Star's upright summary override when one exists.
- [ ] **Step 2:** Run the test. Expected: FAIL.
- [ ] **Step 3:** Move every visible string into `@astro/copy` (`app.*`, `email.*`, `app.patterns.*`) and replace literals with `t(...)`. The existing e2e tests act as the regression check, because defaults equal today's wording.
- [ ] **Step 4:** Run `pnpm test && pnpm db:test && pnpm --filter @astro/app e2e`. Expected: PASS, with no e2e text changes.
- [ ] **Step 5:** Commit `feat(app): wording and card meanings read from the catalogue with published overrides`.

### Task B4: Drafts, publishing, previews, restore and the landing Deploy Hook

**Files:**
- Modify: `packages/db/src/schema.ts`.
- Create:
  - `packages/db/migrations/0004_text.sql`;
  - `apps/admin/lib/text.ts`;
  - `apps/admin/app/api/text/{draft,publish,preview,restore}/route.ts`;
  - `apps/app/app/api/copy/landing/route.ts`, `apps/app/components/PreviewBar.tsx`.
- Modify: `apps/app/proxy.ts` (preview headers).
- Test: `apps/admin/test/text.db.test.ts`, `apps/app/e2e/copy-endpoint.spec.ts`.

**Interfaces:**
- **Tables:**
  - `text_override(key pk, kind, value, updated_by, updated_at)`;
  - `text_version(id serial, kind text check in (landing, app, meanings), snapshot jsonb, published_by, published_at, note)`;
  - `text_preview(id text pk (128-bit base64url), kind, snapshot jsonb, expires_at)`.
- **Grants:** `astro_admin` gets read and write; `astro_web` gets `SELECT` on `text_version` and `text_preview`.
- **Text service:**
  - `saveDraft(db, actor, key, value)` validates with `validateOverride`. `useDefault` deletes the override.
  - `publish(db, actor, kind, note, deps: { fetch, hookUrl, now })`:
    - `meanings` needs owner and step-up;
    - it validates every override of that kind, then inserts the version and writes to the audit log;
    - for `landing`, it checks the limit of one per 2 minutes (`rate_limit` key `astro-publish-landing`), then POSTs `hookUrl` and stores the response status in the audit summary.
  - `restore(db, actor, versionId)` needs step-up and publishes the old snapshot as a new version.
  - `createPreview(db, actor, kind)` returns the id, valid for 30 minutes.
- **App endpoint:** `GET /api/copy/landing` returns `{ version, overrides }`, or 204 when nothing is published, with `Cache-Control: public, max-age=60`. It's public and read-only.
- **App preview:** `?astro-preview=<id>` makes `getCopy` use the preview snapshot. The proxy adds `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and the layout shows `PreviewBar`.

- [ ] **Step 1:** Write the tests:
  - **`text.db.test.ts`:**
    - publishing landing twice within 2 minutes is refused the second time;
    - the hook is POSTed exactly once per publish, and the hook URL never appears in the returned value or the audit summary;
    - an admin publishing `meanings` fails;
    - restore creates version n+1 equal to the old snapshot;
    - an invalid override blocks the publish.
  - **`copy-endpoint.spec.ts`:**
    - 204 before any publish;
    - after a seeded version, the JSON shape matches and the cache header is present;
    - a page with a valid preview id shows the bar and has `no-store`, and an expired id shows live text.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement it. Add `LANDING_DEPLOY_HOOK_URL` as required in the admin's production env parsing.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat: text drafts, publishing, previews, restore and landing rebuilds`.

### Task B5: Text and Card library screens

**Files:**
- Create: `apps/admin/app/(portal)/text/page.tsx` and `components/text/*` (mockup "P3 · Text"); `apps/admin/app/(portal)/cards/page.tsx` and `components/cards/*` (mockup "P3 · Card meanings").
- Test: `apps/admin/e2e/text.spec.ts`, `apps/admin/e2e/cards.spec.ts`.

**Interfaces:**
- **Text screen:**
  - tabs for Landing page, App and Emails, with a list grouped by section and search;
  - an editor showing the default, a character count, placeholder checks, Save draft and Use default;
  - a "How it will read" section preview for landing keys, and "Preview in the app" for app keys;
  - a publish panel listing drafts, Live now and History with Restore.
- **Card library:** default and override for every field, with search and group chips. Owner: Save draft and Publish (step-up). Admin: read-only.

- [ ] **Step 1:** Write the tests:
  - **`text.spec.ts`:**
    - the owner edits the landing hero heading, publishes, and the stub hook server records one POST. Publishing again at once shows "You can publish again in 2 minutes";
    - editing an app string and publishing makes the app show it (cache bypassed in tests);
    - an over-length draft shows the error and can't be saved;
    - restoring v1 shows v3 live.
  - **`cards.spec.ts`:** the owner changes The Star's upright summary and publishes with step-up, and the app's reveal for The Star shows it. An admin sees no inputs or buttons.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the screens from the mockups.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(admin): Text and Card library screens`.

### Task B6: Deployment steps and roadmap (Part B)

- [ ] **Step 1:** Add to `DEPLOYMENT.md`:
  - **Deploy Hook:** Cloudflare → `astro-landing` → Settings → Builds → Deploy Hooks → name `Publish text`, branch `main` → copy the URL and add it as the `astro-admin` secret `LANDING_DEPLOY_HOOK_URL`. Never paste it anywhere else.
  - **Landing build variable `COPY_SOURCE`:** set to `defaults` only until `astro-app` is live, then delete it.
  - **Checks:** publish a landing change and see the footer version update within about 5 minutes; publish an app change and see it within a minute.
- [ ] **Step 2:** Mark Plan 3 done in the roadmap.
- [ ] **Step 3:** Run the full suite from A10 Step 4. Expected: all PASS.
- [ ] **Step 4:** Commit `docs: text publishing steps`, push, and open the Part B pull request.
