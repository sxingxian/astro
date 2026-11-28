# Developing Astro

For developers working on the code. Deploying needs none of this: see `docs/DEPLOYMENT.md`, which is done entirely in the browser.

## Local setup

Node 22, pnpm 10 (from `packageManager`), and a local Postgres 16+ with roles `migrator`, `astro_web` and `astro_admin` (create them before migrating: grants are only given to roles that exist) and databases `astro_dev` and `astro_test`.

```bash
pnpm install
pnpm --filter @astro/landing dev                     # landing page at http://localhost:3000

cp apps/api/.dev.vars.example apps/api/.dev.vars     # development values only (outbox mail, Turnstile off)
DATABASE_URL_MIGRATOR=postgres://migrator:migrator@127.0.0.1:5432/astro_dev pnpm db:migrate

DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm --filter @astro/api stack
                                                     # the app as deployed (free plan): http://127.0.0.1:8792
pnpm --filter @astro/web dev                         # the pages alone, with hot reload (no API)

cp apps/admin/.dev.vars.example apps/admin/.dev.vars # portal: outbox mail, AI gateway stub address
pnpm --filter @astro/admin preview                   # admin portal on http://127.0.0.1:8791/admin
```

The first local owner: sign up in the app, then `insert into staff_role (user_id, role) select id, 'owner' from "user" where email = '…';`. The portal's e2e starts its own AI gateway stub on 127.0.0.1:8799 (`apps/admin/e2e/ai-stub.ts`).

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm db:test              # database tests (run one at a time)
DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm e2e   # landing, app and portal, one at a time (they share the test database)
DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm --filter @astro/api cpu   # CPU per request (Workers Free: 10 ms)
pnpm cf:build:landing                                # the same build Cloudflare runs
pnpm --filter @astro/landing preview                 # wrangler dev, applies _headers like production
E2E_BASE_URL=http://127.0.0.1:8787 pnpm --filter @astro/landing e2e
```

## Database migrations

Migrations live in `packages/db/migrations` (Drizzle) and run on every `astro-api` deploy (`pnpm db:migrate && pnpm cf:deploy:api`). `pnpm db:migrate` reads `DATABASE_URL_MIGRATOR`, refuses to run without it, and prints `migrations: N applied`.

To add one: change `packages/db/src/schema.ts`, run `pnpm --filter @astro/db generate` (or `exec drizzle-kit generate --custom --name <name>` for hand-written SQL), review the SQL, commit.

- **Expand, then contract.** The old Worker serves traffic while a migration runs, so every migration must work with both the old and the new code. Add tables and nullable columns in one release; backfill; make them required or remove old ones in a later release.
- **Grants.** `0001_grants_and_settings.sql` grants `astro_web` only `SELECT, INSERT, UPDATE, DELETE` on the app's tables; `0003_admin.sql` narrows `astro_web` on the staff and AI tables and grants `astro_admin` its own small set (never notes, never DDL). New tables must be granted explicitly in their migration. If a role was created after its migration ran, rerun that `DO $$ … $$` block as `migrator`.
- Tell the owner before a risky migration so they can branch Neon `main` as a restore point.

## The free-plan app (`apps/web` + `apps/api`)

- `apps/web` is the app's pages, pre-built with Vite (React, react-router). It reuses `apps/app`'s components through the `@/` alias and shims `next/navigation`. No inline scripts: the CSP in `apps/web/public/_headers` has no nonce.
- `apps/api` (`astro-api`) serves those files, the API under `/api` (Hono, Neon's HTTPS driver; the WebSocket driver only where a role and its audit entry must be saved together: accepting an invitation or role offer), including the reader pages. The app's browser tests (`apps/app/e2e`) run against this stack. `apps/app` holds the shared screen components and helpers, the unit tests and the browser tests; the Next.js app that lived there (`astro-app`) was retired in Stage 2.
- The CPU check counts only time running code, not waiting for the database. Neon signs the WebSocket driver in with a plain password over TLS; to measure the draw start the same way locally, let `astro_web` use `password` (not `scram-sha-256`) for `astro_test` from 127.0.0.1 in `pg_hba.conf`. With SCRAM it reads about 15 ms higher.

## Notes

- Local secrets stay in `apps/api/.dev.vars` and `apps/admin/.dev.vars` (git-ignored), never in the repo.
- `apps/api/wrangler.jsonc` holds the production plain variables; a deploy replaces dashboard variables with the file's. Secrets are set only in the Cloudflare dashboard.
- Hyperdrive caching must be off for `astro-web`: sessions and limits must read fresh data.
