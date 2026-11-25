# Deploying Astro

Cloudflare runs every deploy and every database migration through **Workers Builds**, its Git integration. GitHub Actions only runs tests on pull requests: it never deploys and holds no Cloudflare or database credentials.

```
push to main ──► Cloudflare Workers Builds
                   install → lint → typecheck → unit tests → build
                   └─► deploy command
                         landing:  wrangler deploy
                         app/admin (plan 2+):  migrate Neon → wrangler deploy
pull request ──► GitHub Actions CI (lint, typecheck, unit, build, e2e) — required to merge
```

## Landing page: one-time setup

1. **Create the Worker by connecting the repo.** In the Cloudflare dashboard go to Workers & Pages → Create → Import a repository, choose `sxingxian/astro`, and name the Worker **`astro-landing`**. The name must match `name` in `apps/landing/wrangler.jsonc`.
2. **Build settings** (Settings → Build):

   | Setting | Value |
   |---|---|
   | Production branch | `main` |
   | Root directory | `/` (repo root, so pnpm sees the whole workspace) |
   | Build command | `pnpm cf:build:landing` |
   | Deploy command | `pnpm cf:deploy:landing` |
   | Non-production branch builds | Optional for the landing page. If on, set the command to `pnpm --filter @astro/landing exec wrangler versions upload` for a preview URL that doesn't touch production. |
   | Build watch paths, include | `apps/landing/*`, `packages/*`, `package.json`, `pnpm-lock.yaml`, `turbo.json` |
   | Build cache | On |

   Node 22 comes from `.nvmrc` and pnpm 10 from `packageManager` in `package.json`; no build variables are needed for the landing page.
3. **Domain.** `wrangler.jsonc` attaches `astro.midnightpoetry.studio` as a custom domain on the first deploy. The `midnightpoetry.studio` zone must already be on Cloudflare.
4. **Protect `main` on GitHub.** Settings → Branches → add a rule for `main`: require a pull request and require the **CI / verify** status check. Workers Builds deploys every commit that lands on `main`, so this is what stops untested code from shipping.

`cf:build:landing` runs `turbo run lint typecheck test build --filter=@astro/landing...`. If any step fails, Cloudflare stops and nothing deploys. The Playwright e2e tests run only in the pull-request check, because the Cloudflare build image has no Chrome.

## Database migrations (from plan 2)

The app and admin Workers own the Neon database. Their Workers Builds deploy command will be:

```
pnpm db:migrate && pnpm cf:deploy:app
```

- **Credential.** Add `DATABASE_URL_MIGRATOR` under Settings → Build → **Build variables and secrets** as a secret. Use Neon's direct (unpooled) connection string for the `migrator` role. Build secrets are not visible to the running Worker; the app reaches Neon through Hyperdrive with the `astro_web` / `astro_admin` roles.
- **Ordering.** `&&` means a failed migration stops the deploy, and the previous version keeps serving.
- **Expand, then contract.** The old Worker keeps serving traffic while the migration runs, so each migration must work with both the old and the new code: add columns and tables first, remove them in a later release.
- **Non-production branch builds: off** for any Worker whose build has `DATABASE_URL_MIGRATOR`. Cloudflare's docs don't say whether build secrets are limited to production builds, so assume they're not. A branch build would otherwise run unreviewed code with the production migrator credential. Use Neon branches locally for preview databases instead.
- **Rollback.** Roll the Worker back in Deployments; the schema stays put, which is why migrations must be backward compatible.

## Check the deployed headers

```bash
curl -sI https://astro.midnightpoetry.studio | grep -iE "content-security-policy|strict-transport|x-content-type|referrer-policy|permissions-policy"
```

Expect a CSP with `script-src 'self' 'sha256-…'`, plus HSTS, `nosniff` and `frame-ancestors 'none'`.

## Run it locally

```bash
pnpm cf:build:landing                       # the same build Cloudflare runs
pnpm --filter @astro/landing preview        # wrangler dev, applies _headers like production
E2E_BASE_URL=http://127.0.0.1:8787 pnpm --filter @astro/landing e2e   # e2e against wrangler dev
```

The admin portal (plan 4) adds its own Worker on the more specific route `astro.midnightpoetry.studio/admin*`; Cloudflare sends `/admin` traffic there and everything else to `astro-landing`.
