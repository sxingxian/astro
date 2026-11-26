# Developing Astro

For developers working on the code. Deploying needs none of this: see `docs/DEPLOYMENT.md`, which is done entirely in the browser.

## Local setup

Node 22, pnpm 10 (from `packageManager`), and a local Postgres 16+ with roles `migrator` and `astro_web` and databases `astro_dev` and `astro_test`.

```bash
pnpm install
pnpm --filter @astro/landing dev                     # landing page at http://localhost:3000

cp apps/app/.dev.vars.example apps/app/.dev.vars     # development values only (outbox mail, Turnstile off)
DATABASE_URL_MIGRATOR=postgres://migrator:migrator@127.0.0.1:5432/astro_dev pnpm db:migrate
pnpm --filter @astro/app preview                     # OpenNext build + wrangler dev on http://127.0.0.1:8790
```

## Tests

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm db:test              # database tests (run one at a time)
DATABASE_URL_TEST=postgres://migrator:migrator@127.0.0.1:5432/astro_test pnpm --filter @astro/app e2e
pnpm cf:build:landing                                # the same build Cloudflare runs
pnpm --filter @astro/landing preview                 # wrangler dev, applies _headers like production
E2E_BASE_URL=http://127.0.0.1:8787 pnpm --filter @astro/landing e2e
```

## Database migrations

Migrations live in `packages/db/migrations` (Drizzle) and run on every `astro-app` deploy (`pnpm db:migrate && pnpm cf:deploy:app`). `pnpm db:migrate` reads `DATABASE_URL_MIGRATOR`, refuses to run without it, and prints `migrations: N applied`.

To add one: change `packages/db/src/schema.ts`, run `pnpm --filter @astro/db generate` (or `exec drizzle-kit generate --custom --name <name>` for hand-written SQL), review the SQL, commit.

- **Expand, then contract.** The old Worker serves traffic while a migration runs, so every migration must work with both the old and the new code. Add tables and nullable columns in one release; backfill; make them required or remove old ones in a later release.
- **Grants.** `0001_grants_and_settings.sql` grants `astro_web` only `SELECT, INSERT, UPDATE, DELETE` on the app's tables. If `astro_web` was created after that migration ran, rerun its `DO $$ … $$` block as `migrator`.
- Tell the owner before a risky migration so they can branch Neon `main` as a restore point.

## Notes

- Local secrets stay in `apps/app/.dev.vars` (git-ignored), never in the repo.
- `apps/app/wrangler.jsonc` holds the production plain variables; a deploy replaces dashboard variables with the file's. Secrets are set only in the Cloudflare dashboard.
- Hyperdrive caching must be off for `astro-web`: sessions and limits must read fresh data.
