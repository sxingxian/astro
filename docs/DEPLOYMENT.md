# Deploying Astro

Astro runs entirely on **Cloudflare** (Workers, Workers Builds, Hyperdrive, R2, Turnstile, AI Gateway, Access) and **Neon** Postgres in Singapore. Cloudflare runs every deploy and every database migration. GitHub stores the code and runs the pull-request tests; it never deploys and holds no Cloudflare, Neon or Stripe secrets. Allow about an hour the first time.

| Host | Serves | Cloudflare Worker | Status |
| --- | --- | --- | --- |
| `astro.midnightpoetry.studio` | Landing page | `astro-landing` | **Built (plan 1)** |
| `astroapp.midnightpoetry.studio` | The app: daily draw, readings, journal, accounts | `astro-app` | Plan 2 |
| `astro.midnightpoetry.studio/admin` | Admin portal: pricing, contacts, AI provider, readers | `astro-admin` | Plan 4 |

Sections marked *(plan N)* describe settings for parts that aren't built yet. They're here so the whole setup is planned in one place; the names below (Workers, secrets, roles) are the ones those plans will use.

## How a release goes out

```
pull request ──► GitHub Actions "CI / verify": lint, typecheck, unit tests, build, Playwright e2e
                 (required by the main ruleset; no secrets)
merge to main ──► Cloudflare Workers Builds, one build per Worker whose watch paths changed
                   install → lint → typecheck → unit tests → build
                   └─► deploy command
                         astro-landing:  wrangler deploy
                         astro-app:      migrate Neon (migrator role) → wrangler deploy      (plan 2)
                         astro-admin:    wrangler deploy                                      (plan 4)
```

If any step fails, that Worker isn't deployed and the previous version keeps serving.

## 1. Cloudflare account and domain

1. Add the zone `midnightpoetry.studio` to your Cloudflare account (Websites → Add a domain) and switch the nameservers at your registrar. Every Worker below claims its hostname as a **custom domain** on its first deploy, which creates the DNS record and certificate, so this zone must be in the same account.
2. SSL/TLS → Overview: **Full (strict)**. SSL/TLS → Edge Certificates: **Always Use HTTPS** on, **Minimum TLS 1.2**.
3. Security → Bots: **Bot Fight Mode** on.
4. If `astro.midnightpoetry.studio` was ever attached to a Pages project or another Worker, remove it there first.

## 2. GitHub: protect `main`

Workers Builds deploys every commit that lands on `main`, so `main` must only accept tested pull requests.

Repository → **Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

- **Name:** `Protect main`. **Enforcement status:** Active. **Bypass list:** empty.
- **Target branches:** Add target → **Include default branch**.
- **Rules:**
  - Restrict deletions, Block force pushes (on by default).
  - **Require a pull request before merging**, required approvals **0** (GitHub doesn't let you approve your own pull request).
  - **Require status checks to pass** → Add checks → **`verify`** (from GitHub Actions). Tick **Require branches to be up to date before merging**.

Check: a direct `git push` to `main` is refused, and a pull request shows "Required: verify".

## 3. Landing page Worker: `astro-landing`

Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → GitHub → `sxingxian/astro`. Name the Worker **`astro-landing`**: it must match `name` in `apps/landing/wrangler.jsonc`.

> **Don't use the default deploy command `npx wrangler deploy`.** `npx` runs npm, which can't read the pnpm workspace links (`workspace:*`) and fails with `EUNSUPPORTEDPROTOCOL`. Use the `pnpm` commands below; Wrangler is installed with the project.

Settings → **Build**:

- **Git branch (production):** `main`
- **Root directory:** `/` (repository root, so pnpm sees the whole workspace)
- **Build command:** `pnpm install --frozen-lockfile && pnpm cf:build:landing`
- **Deploy command:** `pnpm cf:deploy:landing`
- **Non-production branch builds:** off. `workers_dev` and `preview_urls` are off in `wrangler.jsonc`, so the Worker only ever answers on its custom domain.
- **Build variables:** `NODE_VERSION=22`. pnpm 10 comes from `packageManager` in `package.json`.
- **Build watch paths → Include:** `apps/landing/*`, `packages/*`, `package.json`, `pnpm-lock.yaml`, `turbo.json`
- **Build cache:** on

`cf:build:landing` runs `turbo run lint typecheck test build --filter=@astro/landing...`, so the landing page and every package it uses are linted, type-checked and unit-tested before the static export is built. The Playwright end-to-end tests run only in the pull-request check, because the Cloudflare build image has no Chrome.

The landing page has no runtime variables or secrets. Its security headers (CSP with hashed inline scripts, HSTS, `nosniff`, COOP, `frame-ancestors 'none'`, Permissions-Policy) are in `apps/landing/out/_headers`, written at build time by `apps/landing/scripts/csp.mjs`.

**First deploy:** push to `main` (or press **Retry build** on the Worker's Deployments tab). The custom domain is created on that deploy.

## 4. Neon Postgres *(plan 2)*

1. At neon.tech create a project named `astro`, **Region: AWS Asia Pacific (Singapore)**, Postgres 17. The default branch `main` is production.
2. Create three roles (Roles → New role). The SQL that grants each role exactly what it needs ships with plan 2's first migration.

   | Role | Used by | Can do |
   | --- | --- | --- |
   | `migrator` | Workers Builds deploy command only | Owns the schema; runs migrations |
   | `astro_web` | `astro-app` through Hyperdrive | Read/write member data; no DDL |
   | `astro_admin` | `astro-admin` through Hyperdrive | Admin tables and the audit trail; no DDL |

3. Copy the **direct** (unpooled) connection string for each role from **Connection details**. Store them in your password manager; they go into Cloudflare below and nowhere else.
4. For local development, create a Neon branch `dev` from `main` and use its connection string in `apps/app/.dev.vars` (git-ignored).

## 5. Hyperdrive *(plan 2)*

The running Workers reach Neon through Hyperdrive, which pools connections and keeps the database password out of the Worker's code.

```bash
pnpm --filter @astro/app exec wrangler hyperdrive create astro-web   --connection-string="<astro_web direct connection string>"
pnpm --filter @astro/app exec wrangler hyperdrive create astro-admin --connection-string="<astro_admin direct connection string>"
```

Put each returned id in the matching `wrangler.jsonc` under `hyperdrive` (binding `DB`). The ids aren't secret; the connection strings are stored by Hyperdrive, not in the repo.

## 6. App Worker: `astro-app` *(plan 2)*

Create a second Worker from the same repository, named **`astro-app`**.

Settings → **Build**:

- **Root directory:** `/`
- **Build command:** `pnpm install --frozen-lockfile && pnpm cf:build:app`
- **Deploy command:** `pnpm db:migrate && pnpm cf:deploy:app`
- **Non-production branch builds: off.** The build has the production migrator credential. Cloudflare's docs don't say whether build secrets are limited to production builds, so assume they aren't; a branch build would otherwise run unreviewed code with that credential.
- **Build variables:** `NODE_VERSION=22`
- **Build secrets:** `DATABASE_URL_MIGRATOR` = the `migrator` direct connection string. Build secrets aren't available to the running Worker.
- **Build watch paths → Include:** `apps/app/*`, `packages/*`, `db/*`, `package.json`, `pnpm-lock.yaml`, `turbo.json`

Settings → **Variables and Secrets** (runtime):

| Name | Type | Value |
| --- | --- | --- |
| `APP_URL` | Variable | `https://astroapp.midnightpoetry.studio` |
| `BETTER_AUTH_SECRET` | Secret | `openssl rand -hex 32` |
| `TURNSTILE_SECRET_KEY` | Secret | from section 8 |
| `RESEND_API_KEY` | Secret | from section 9 |
| `EMAIL_FROM` | Variable | e.g. `Astro <hello@midnightpoetry.studio>` |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Secret | from section 10 *(plan 3)* |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | Secret | from section 11; only the providers you use *(plan 3)* |

**Never put the migrator connection string, Stripe keys or AI keys in a runtime variable, `wrangler.jsonc`, a `.env` file committed to git, or GitHub.**

## 7. Database migrations *(plan 2)*

Migrations live in `db/migrations` (Drizzle) and run from the `astro-app` deploy command: `pnpm db:migrate && pnpm cf:deploy:app`.

- **Order.** `&&` means a failed migration stops the deploy; the previous Worker keeps serving and the schema is left as the migration tool's transaction left it.
- **Expand, then contract.** The old Worker serves traffic while the migration runs, so every migration must work with both the old and the new code. Add tables and nullable columns in one release; backfill; make them required or remove old ones in a later release.
- **Before a risky migration,** create a Neon branch of `main` (Branches → Create branch) as an instant restore point.
- **Admin Worker:** `astro-admin` never migrates. It deploys after `astro-app` has migrated, and only reads columns that already exist.

## 8. Cloudflare Turnstile *(plan 2)*

Cloudflare dashboard → **Turnstile → Add widget**:

- **Hostnames:** `astroapp.midnightpoetry.studio`, `astro.midnightpoetry.studio`
- **Mode:** Managed

Put the **site key** in the app's build variable `PUBLIC_TURNSTILE_SITE_KEY` and the **secret key** in the runtime secret `TURNSTILE_SECRET_KEY` (section 6). Turnstile protects sign-up, sign-in, password reset, contact forms and guest draws.

## 9. Email for accounts (Resend) *(plan 2)*

Better Auth sends sign-up confirmations, password resets and 2-step codes.

1. Create a Resend account, add the sending domain and the DNS records it asks for (SPF, DKIM).
2. Create an API key with **sending access only** → `RESEND_API_KEY`.
3. Set `EMAIL_FROM` to an address on that domain.

Until the key is set, sign-up and password reset show "We can't send email right now".

## 10. Stripe *(plan 3)*

1. Create and activate the Stripe account (business details, bank account).
2. Developers → **Webhooks → Add endpoint**: `https://astroapp.midnightpoetry.studio/api/stripe/webhook`, events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`.
3. Developers → **API keys** → secret key → `STRIPE_SECRET_KEY`. Use a **restricted key** limited to Checkout Sessions, Prices, Products and Refunds.
4. Prices per currency are set in the admin portal (Plan prices) and mirrored into Stripe; nothing is hard-coded.
5. Rehearse in Stripe test mode first with card `4242 4242 4242 4242`.

## 11. AI readings: AI Gateway *(plan 3)*

1. Cloudflare dashboard → **AI → AI Gateway → Create gateway** named `astro`. Turn on **logging** and **rate limiting**; set a daily spend alert at the provider.
2. Create an API key at each provider you want available (Anthropic, OpenAI, Google) and set it as a runtime secret on `astro-app` (section 6).
3. In the admin portal → **AI**, choose the provider and model. The app calls the provider through the gateway; Workers AI isn't used.

## 12. Card art: R2 *(plan 2)*

R2 → **Create bucket** `astro-card-art` (location hint: Asia-Pacific). Bind it to `astro-app` and `astro-admin` as `CARD_ART` in `wrangler.jsonc`. Images are served by the Worker with long-lived cache headers; the bucket itself isn't public.

## 13. Admin Worker: `astro-admin` *(plan 4)*

Create a third Worker from the repository, named **`astro-admin`**, with the same build settings pattern (`pnpm cf:build:admin`, `pnpm cf:deploy:admin`, non-production branch builds off). Its `wrangler.jsonc` claims the **route** `astro.midnightpoetry.studio/admin*`. A route with a path is more specific than the landing page's custom domain, so Cloudflare sends `/admin` traffic here and everything else to `astro-landing`. Check this on the first deploy.

**Cloudflare Access** (Zero Trust → Access → Applications → Add → Self-hosted):

- **Application domain:** `astro.midnightpoetry.studio/admin*`
- **Policy:** Allow, **Emails** = the staff addresses. Session duration 8 hours.

Access stops anyone who isn't staff before the admin portal loads. Staff then sign in to Astro itself, where an authenticator app (TOTP) is **required**.

**First super admin:** sign up at `https://astroapp.midnightpoetry.studio/sign-up`, confirm the email, then in Neon's SQL editor (as `migrator`):

```sql
update staff_roles set role = 'super_admin'
where user_id = (select id from "user" where email = 'you@example.com');
```

Invite other staff from the admin portal; each must enrol an authenticator before any action works.

## 14. After the first deploy

Landing page (now):

- [ ] `https://astro.midnightpoetry.studio` loads, and `https://astro-landing.<account>.workers.dev` does **not** (workers.dev is off).
- [ ] Headers:

  ```bash
  curl -sI https://astro.midnightpoetry.studio | grep -iE "content-security-policy|strict-transport|x-content-type|referrer-policy|permissions-policy|cross-origin-opener"
  ```

  Expect a CSP with `script-src 'self' 'sha256-…'`, HSTS, `nosniff`, `frame-ancestors 'none'`.
- [ ] `https://securityheaders.com` against the landing page: grade A.
- [ ] Browser console: no errors, no CSP violations.
- [ ] On a phone (360px wide): no sideways scrolling; the deck and pairs fit.
- [ ] With **Reduce motion** on (iOS Settings → Accessibility → Motion): nothing animates and every section is visible.
- [ ] Keyboard only: Tab shows "Skip to content"; "Begin the journey" moves to the deck.

App and admin *(plans 2–4)*:

- [ ] Sign up, confirm the email, turn on 2-step, sign out and back in with a code.
- [ ] Draw today's card as a guest and as a member; check one reading per spread per day.
- [ ] After a reading, verify the fingerprint on the Verify screen.
- [ ] Buy an AI reading in Stripe test mode; check it appears in the journal and the admin portal.
- [ ] Open `/admin` from a browser not signed in to Access: Access blocks it.
- [ ] Have the privacy notice and terms reviewed before public launch (`/terms` and `/privacy` don't exist yet).

## 15. Rolling back

- **A Worker:** the Worker → **Deployments** → pick the previous version → **Rollback**. Instant; no rebuild.
- **The database:** migrations aren't rolled back automatically. Because they're expand-then-contract, the previous Worker version runs against the newer schema. If data must be restored, use Neon **Restore** to a point in time or the branch made before the migration.

## 16. Local development

```bash
pnpm install
pnpm --filter @astro/landing dev                     # landing page at http://localhost:3000
pnpm cf:build:landing                                # the same build Cloudflare runs
pnpm --filter @astro/landing preview                 # wrangler dev, applies _headers like production
E2E_BASE_URL=http://127.0.0.1:8787 pnpm --filter @astro/landing e2e   # e2e against wrangler dev
```

## Release safety

- GitHub holds no deploy or database credentials, and its only workflow (`CI`) has `contents: read`. Cloudflare and Neon credentials live in Cloudflare (Workers Builds build secrets, Worker runtime secrets, Hyperdrive).
- CI installs only the versions in `pnpm-lock.yaml` (`--frozen-lockfile`); so does every Cloudflare build. Dependabot opens weekly update pull requests for npm packages and GitHub Actions.
- Only `esbuild`, `workerd` and `sharp` may run install scripts (`pnpm.onlyBuiltDependencies`).
- Workers serve only their custom domains (`workers_dev` and `preview_urls` are off).
- Non-production branch builds stay off for any Worker whose build has `DATABASE_URL_MIGRATOR`.
- To do: pin GitHub Actions to exact commit SHAs (with the version in a comment).
