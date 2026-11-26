# Deploying Astro

Every step below is done on a website, in your browser: **Cloudflare**, **GitHub**, **Neon** and **Resend** now, and **Stripe** and the AI providers later. You never need a terminal, Command Prompt or PowerShell. Cloudflare runs every build, deploy and database migration for you. Allow about an hour the first time.

| Address | Serves | Cloudflare Worker | Status |
| --- | --- | --- | --- |
| `astro.midnightpoetry.studio` | Landing page | `astro-landing` | **Built (plan 1)** |
| `astroapp.midnightpoetry.studio` | The app: daily draw, readings, journal, accounts | `astro-app` | **Built (plan 2)** |
| `astro.midnightpoetry.studio/admin` | Admin portal: pricing, contacts, AI provider, readers | `astro-admin` | Plan 4 |

Sections marked *(plan N)* are for parts that aren't built yet. They're here so the whole setup is planned in one place.

## Before you start

**Accounts:** Cloudflare (with `midnightpoetry.studio`), GitHub (owner of `sxingxian/astro`), Neon, Resend.

**A password manager with a password generator** (Bitwarden, 1Password, Apple Passwords or similar). You'll create several secret values. For each one:

- Generate it in the password manager: **at least 40 characters, letters and numbers only** (hyphens are fine; no other symbols, because they break database addresses).
- Save it there with a clear name (for example "Astro · Neon migrator password").
- Paste it only into the website field this guide names. Never put it in an email, a chat, a GitHub file or a screenshot.

**Where each value ends up:**

| Value | Made in | Goes into |
| --- | --- | --- |
| `migrator` database password and address | Neon (step 4) | Cloudflare → `astro-app` → build secret `DATABASE_URL_MIGRATOR` |
| `astro_web` database password and address | Neon (step 4) | Cloudflare → Hyperdrive `astro-web` (step 5) |
| Hyperdrive ID (not secret) | Cloudflare (step 5) | GitHub file `apps/app/wrangler.jsonc` (step 8) |
| Turnstile site key (not secret) | Cloudflare (step 6) | GitHub file `apps/app/wrangler.jsonc` (step 8) |
| Turnstile secret key | Cloudflare (step 6) | `astro-app` secret `TURNSTILE_SECRET_KEY` |
| Resend API key | Resend (step 7) | `astro-app` secret `RESEND_API_KEY` |
| Sign-in secret (see step 9 for what it does) | Your password manager (64 characters) | `astro-app` secret `BETTER_AUTH_SECRET` |

The two values that aren't secret (Hyperdrive ID and Turnstile site key) can instead be sent to Claude, who will put them into the code for you.

## How a release goes out

```
pull request on GitHub ──► GitHub runs the tests ("verify"); a pull request can't merge until they pass
merge to main          ──► Cloudflare builds each Worker whose files changed
                           tests → build → deploy
                           astro-app also updates the database first; if that fails, nothing is deployed
```

If any step fails, that Worker isn't deployed and the previous version keeps serving.

## 1. Cloudflare: domain and security settings

At **dash.cloudflare.com**:

1. **Add a domain** → `midnightpoetry.studio`, then change the nameservers at your domain registrar to the two Cloudflare shows. Each Worker creates its own address and certificate on its first deploy, so the domain must be in the same Cloudflare account.
2. Open the domain → **SSL/TLS → Overview** → **Full (strict)**. Then **SSL/TLS → Edge Certificates** → **Always Use HTTPS** on, **Minimum TLS Version** 1.2.
3. **Security → Bots** → **Bot Fight Mode** on.
4. If `astro.midnightpoetry.studio` was ever attached to a Pages project or another Worker, remove it there first.

## 2. GitHub: protect `main`

Cloudflare deploys every change that lands on `main`, so `main` must only accept tested pull requests.

At **github.com/sxingxian/astro** → **Settings → Rules → Rulesets → New ruleset → New branch ruleset**:

- **Ruleset name:** `Protect main`. **Enforcement status:** Active. **Bypass list:** leave empty.
- **Target branches:** **Add target → Include default branch**.
- Tick:
  - **Restrict deletions** and **Block force pushes** (already ticked).
  - **Require a pull request before merging**, with **Required approvals: 0** (GitHub doesn't let you approve your own pull request).
  - **Require status checks to pass** → **Add checks** → type `verify` and pick it. Also tick **Require branches to be up to date before merging**.
- **Create**.

Check: open any file on `main` and click the pencil. GitHub should only offer to save your change on a new branch with a pull request, not straight onto `main`.

## 3. Cloudflare: landing page Worker `astro-landing`

At **dash.cloudflare.com** → **Workers & Pages → Create → Import a repository** → connect GitHub if asked → pick `sxingxian/astro`.

- **Project name:** `astro-landing` (it must be exactly this).
- **Build command:** `pnpm install --frozen-lockfile && pnpm cf:build:landing`
- **Deploy command:** `pnpm cf:deploy:landing`. Replace the suggested `npx wrangler deploy`, which fails on this project.
- **Root directory:** `/`

After it's created, open the Worker → **Settings → Build** and check:

- **Git branch (production):** `main`
- **Non-production branch builds:** off
- **Build variables:** add `NODE_VERSION` = `22`
- **Build watch paths → Include:** `apps/landing/*`, `packages/*`, `package.json`, `pnpm-lock.yaml`, `turbo.json`
- **Build cache:** on

The first build starts by itself. If it ran before you finished the settings, open **Deployments** and press **Retry build**. The address `astro.midnightpoetry.studio` is created on that first deploy. The landing page has no secrets.

## 4. Neon: database and its two users

At **console.neon.tech**:

1. **New project** → name `astro`, **Region: AWS Asia Pacific (Singapore)**, Postgres 17. The branch called `main` is production.
2. Generate two passwords in your password manager (letters and numbers, 40+ characters): one for **migrator** (updates the database structure during deploys) and one for **astro_web** (what the live app uses).
3. In the project, open **SQL Editor** (left menu). Check the database selector shows `neondb`. Paste this, put your two passwords between the quotes, and press **Run**:

   ```sql
   CREATE ROLE migrator LOGIN PASSWORD 'paste-migrator-password-here';
   GRANT ALL ON SCHEMA public TO migrator;
   GRANT CREATE ON DATABASE neondb TO migrator;  -- lets it keep its record of applied updates
   CREATE ROLE astro_web LOGIN PASSWORD 'paste-astro-web-password-here';
   CREATE EXTENSION IF NOT EXISTS pgcrypto;
   ```

   Create the users here in the SQL Editor, not on Neon's **Roles** page. Users made on the Roles page get administrator powers the app shouldn't have. The last line turns on the database's built-in password hashing, which Astro uses for sign-ins.

   Then clear the editor so the passwords aren't left on screen.
4. Check the result. Run each line on its own in the SQL Editor:

   ```sql
   select rolname, rolsuper from pg_roles where rolname in ('migrator','astro_web');
   select pg_has_role('astro_web', 'neon_superuser', 'member');
   select has_database_privilege('migrator', 'neondb', 'CREATE');
   ```

   The first should list both users with `rolsuper` = `f`, the second should return `f`, and the third should return `t`. If the app's build log ever says `permission denied for database neondb`, run `GRANT CREATE ON DATABASE neondb TO migrator;` in the SQL Editor and retry the build. On the app's first deploy, Cloudflare gives `astro_web` permission to read and write the app's data, and nothing more. Do this step before the app's first deploy (step 9).
5. **Build the two database addresses.** A database address has the user name and password built in. You copy Neon's address once, then make two versions of it: one for `migrator` and one for `astro_web`.

   **a. Copy Neon's address.** On the project dashboard press **Connect**:
   - **Branch:** `main`. **Database:** `neondb`. **Role:** `neondb_owner`.
   - Turn **Connection pooling off**. Hyperdrive does the pooling, so the address must not contain `-pooler`.
   - Copy the address. It has this shape:

     ```
     postgresql://neondb_owner:XXXX@ep-something-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
                  └─ user name ─┘└pw┘└────────── keep everything from the @ onwards ──────────┘
     ```

   **b. Make the two versions in your password manager.** Work inside the password manager, not a notes app or document, so the passwords are never stored anywhere unprotected.
   1. Create an entry named "Astro · Neon migrator address" and paste Neon's address into its notes field.
   2. Select the part between `postgresql://` and the `@`. That's `neondb_owner:` plus Neon's password.
   3. Type `migrator:` followed by the migrator password from item 2 in its place.
   4. Create a second entry, "Astro · Neon astro_web address", paste Neon's address again, and replace the same part with `astro_web:` followed by the astro_web password.

   **Worked example.** Say Neon's address is:

   ```
   postgresql://neondb_owner:npg_Ab12Cd34@ep-cool-river-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   and your two passwords are `Q7hT2mVx9KpL4sWe8RbN3cYz6UfJ1dGa5HqM` (migrator) and `Lw3Ez8NcR1vTg6YpK9sMh2QaX5uBj7DfC4Hn` (astro_web). The two addresses are:

   ```
   postgresql://migrator:Q7hT2mVx9KpL4sWe8RbN3cYz6UfJ1dGa5HqM@ep-cool-river-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   postgresql://astro_web:Lw3Ez8NcR1vTg6YpK9sMh2QaX5uBj7DfC4Hn@ep-cool-river-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
   ```

   These are made-up examples; use your own passwords.

   **c. Check each address before using it.**
   - [ ] It starts with `postgresql://migrator:` or `postgresql://astro_web:`.
   - [ ] There's exactly one `:` between the user name and the password, and exactly one `@` after the password.
   - [ ] There are no spaces, and no `<`, `>` or quote marks left over.
   - [ ] The password is letters and numbers only. Characters such as `@`, `/`, `#` or `?` break the address; if yours has any, generate a new password and change it in Neon's SQL Editor with `ALTER ROLE migrator PASSWORD '…';` (or `astro_web`).
   - [ ] The part after the `@` doesn't contain `-pooler`.

   **d. Where each one goes.**
   - **migrator address:** Cloudflare → `astro-app` → build secret `DATABASE_URL_MIGRATOR` (step 9).
   - **astro_web address:** Cloudflare → Hyperdrive `astro-web` (step 5).

## 5. Cloudflare: Hyperdrive (the app's link to the database)

Hyperdrive keeps the app's connections to Neon fast and keeps the database password out of the code.

**Find it.** Hyperdrive isn't under Workers & Pages. Either:

- open **https://dash.cloudflare.com/?to=/:account/workers/hyperdrive** (pick your account if asked), or
- at **dash.cloudflare.com**, in the left menu open **Storage & databases → Hyperdrive**. Some accounts call it **Postgres & MySQL (Hyperdrive)**.

**Create the configuration.** Press **Create configuration** (top right).

- If it asks what kind of database, choose your own **public database** (Postgres). Don't pick a private database, Tunnel, or a provider such as PlanetScale.
- **Name:** `astro-web`
- **Connection details:**
  - If there's one box for a connection string, paste the **astro_web** address from step 4.
  - If it shows separate boxes (sometimes behind **Manual entry**), copy each part from that address:

    | Box | Value |
    | --- | --- |
    | Database type | PostgreSQL |
    | Host | the part after `@` up to the next `/`, for example `ep-something-123456.ap-southeast-1.aws.neon.tech` |
    | Port | `5432` |
    | Database | `neondb` |
    | User | `astro_web` |
    | Password | the astro_web password |

- Press **Create**. Cloudflare tests the connection before saving. If it fails, check the address has no `-pooler` in it (step 4), then try again without `&channel_binding=require` at the end.

**Copy the ID.** Back on the Hyperdrive page, open `astro-web`. Its **ID** is a 32-character code of letters and numbers on that page. It isn't secret; you'll use it in step 8.

**Turn caching off.** Open `astro-web` → **Settings**. If there's a **Caching** section, switch caching **off** and **Save**. This matters for security: with caching on, a session that was just signed out or revoked can keep working for up to about a minute. Cloudflare's own docs only describe this switch for the command line. If your Settings page has no caching option, send Claude a screenshot of it before the app's first deploy, and Claude will handle it another way.

*(plan 4)* Later you'll make a second configuration, `astro-admin`, for the admin portal in the same way.

## 6. Cloudflare: Turnstile (bot check on forms)

At **dash.cloudflare.com** → **Turnstile → Add widget**:

- **Widget name:** `Astro`
- **Hostnames:** `astroapp.midnightpoetry.studio` and `astro.midnightpoetry.studio`
- **Widget mode:** Managed
- **Create**

Copy the **site key** (public, for step 8) and the **secret key** (save it in your password manager, for step 9). Turnstile protects sign-up, sign-in, password resets and a guest's first draw of the day.

## 7. Resend: email for accounts

Astro sends sign-up confirmations, password resets, and a heads-up when someone tries to sign up with an email that already has an account.

At **resend.com**:

1. **Domains → Add domain** → `app.midnightpoetry.studio` (the sending address's domain), region nearest Singapore. Add the DNS records Resend shows in Cloudflare (**your domain → DNS → Records → Add record**, copying each type, name and value exactly), or let Resend add them for you if it offers to connect to Cloudflare. Wait until Resend shows the domain as **Verified**.
2. **API Keys → Create API key** → name `astro-app`, **Permission: Sending access**, domain `app.midnightpoetry.studio`. Save the key in your password manager (step 9).

Emails come from `astro-noreply@app.midnightpoetry.studio` (set in step 8). Resend only sends from a domain it has verified, so the domain in Resend must be exactly `app.midnightpoetry.studio`.

## 8. GitHub: Hyperdrive ID, Turnstile site key and sending address

**Done (26 Nov).** `apps/app/wrangler.jsonc` now holds:

- Hyperdrive ID `a8972b247bd840468e460b7110605f0a`;
- Turnstile site key `0x4AAAAAAGT4jVGbsgfhz3rb`;
- sending address `Astro <astro-noreply@app.midnightpoetry.studio>`.

None of these is secret. You only need this step again if you recreate the Hyperdrive configuration or the Turnstile widget, or change the sending address.

To change them later, send the new values to Claude, or edit the file on github.com:

- Open `sxingxian/astro` → `apps/app/wrangler.jsonc` → the **pencil** (Edit).
- Change the value between the quotes, keeping every quote mark and comma.
- **Commit changes…** → **Create a new branch for this commit and start a pull request** → **Propose changes** → **Create pull request**.
- When the **verify** check is green, **Merge pull request → Confirm merge**.

## 9. Cloudflare: app Worker `astro-app`

> **Plan:** the app runs on **Workers Free**. Cloudflare allows 64 MiB per Worker on both plans (the app is about 18 MiB) and 10 ms of processing time per request on Free. Sign-in password checks run inside the database, so they don't use that time. After the first deploy, check step 15. Only if pages regularly go over 10 ms, upgrade to Workers Paid ($5 a month); nothing else changes.

Do steps 4–8 first.

At **dash.cloudflare.com** → **Workers & Pages → Create → Import a repository** → `sxingxian/astro`:

- **Project name:** `astro-app` (exactly this)
- **Build command:** `pnpm install --frozen-lockfile && pnpm cf:build:app`
- **Deploy command:** `pnpm db:migrate && pnpm cf:deploy:app`. The first half updates the database structure before each deploy.
- **Root directory:** `/`

Open the Worker → **Settings → Build**:

- **Git branch (production):** `main`
- **Non-production branch builds: off.** The build holds the database's migrator password, so it must only ever build reviewed code from `main`.
- **Build variables and secrets:**
  - add `NODE_VERSION` = `22` (Text);
  - add `DATABASE_URL_MIGRATOR` (**Secret**) = the **migrator** address from step 4.
- **Build watch paths → Include:** `apps/app/*`, `packages/*`, `package.json`, `pnpm-lock.yaml`, `turbo.json`

Then **Settings → Variables and Secrets → Add**, choosing type **Secret** for each:

| Name | Value |
| --- | --- |
| `BETTER_AUTH_SECRET` | a new 64-character value from your password manager, letters and numbers |
| `TURNSTILE_SECRET_KEY` | Turnstile secret key (step 6) |
| `RESEND_API_KEY` | Resend API key (step 7) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | from step 11 *(plan 3)* |
| `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY` | from step 12, only the providers you use *(plan 3)* |

**What `BETTER_AUTH_SECRET` is for.** Hashing passwords in the database (Workers Free) didn't remove the need for it, because it does other jobs:

- **Signs sign-in cookies.** The app can tell a real session from a forged one.
- **Signs email links.** Confirmation and password-reset links can't be faked or altered.
- **Encrypts 2-step sign-in.** Each member's authenticator key and backup codes are encrypted with it before they're stored, so someone who copied the database still couldn't produce their codes.

Treat it like a master key:

- Make it once, keep it in your password manager, and never change it casually. Changing it signs everyone out and breaks every member's 2-step sign-in.
- If it may have leaked, tell Claude. Better Auth can switch to a new secret while still accepting the old one, but the app needs a small change to do that safely.

Finally, **Deployments → Retry build** (or merge any pull request). In the build log you should see `migrations: N applied`, then the deploy. The address `astroapp.midnightpoetry.studio` is created on that first deploy.

If the first build ran before the settings were in place, it may have failed or the app may show an error page. That's expected: the app refuses to run on its real address while a secret is missing. Add what's missing and press **Retry build**.

The app's other settings (address, sending email, Turnstile on, leaked-password check on) live in `apps/app/wrangler.jsonc`, because each deploy replaces settings typed into the dashboard with the file's. Only secrets go in the dashboard.

**Never put the migrator address, Stripe keys or AI keys anywhere except the Cloudflare secret fields above.**

## 10. Database updates (nothing to do)

Cloudflare updates the database structure on every `astro-app` deploy (`pnpm db:migrate` in the deploy command). You don't run anything. A few things worth knowing:

- If an update fails, the deploy stops and the current version keeps serving.
- Every update is written so the current version and the new one both work during the switch.
- Before a big change, Claude will say so. Make a restore point first: Neon → **Branches → Create branch** from `main`.
- *(plan 4)* The admin Worker never changes the database structure.

## 11. Stripe *(plan 3)*

At **dashboard.stripe.com**:

1. Create and activate the account (business details, bank account).
2. **Developers → Webhooks → Add endpoint**:
   - URL `https://astroapp.midnightpoetry.studio/api/stripe/webhook`;
   - events `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `charge.refunded`, `charge.dispute.created`.

   Copy the **Signing secret** → `STRIPE_WEBHOOK_SECRET` (step 9).
3. **Developers → API keys → Create restricted key**, allowing only Checkout Sessions, Prices, Products and Refunds → `STRIPE_SECRET_KEY`.
4. Prices per currency are set in Astro, not typed into Stripe by hand.
5. Rehearse in **Test mode** first, paying with card `4242 4242 4242 4242`.

## 12. AI readings: AI Gateway *(plan 3)*

1. At **dash.cloudflare.com** → **AI → AI Gateway → Create gateway** → name `astro`. Turn on **logging** and **rate limiting**.
2. At each AI provider you want (Anthropic, OpenAI, Google), create an API key and set a monthly spending limit there. Add each key as an `astro-app` secret (step 9).
3. Choose the provider and model in Astro's admin portal *(plan 4)*. The app always calls the provider through the gateway.

## 13. Card art: R2 *(later plan)*

The app currently draws cards as line art, so nothing is needed yet. When the final artwork is ready: **dash.cloudflare.com → R2 → Create bucket** `astro-card-art`, location hint Asia-Pacific. Leave public access off; the app serves the images itself.

## 14. Admin Worker `astro-admin` *(plan 4)*

Create a third Worker the same way as step 9, named **`astro-admin`**. Plan 4 gives its exact build and deploy commands, with non-production branch builds off. It answers on `astro.midnightpoetry.studio/admin`; everything else at that address stays the landing page.

**Cloudflare Access** (keeps everyone but staff out): **dash.cloudflare.com → Zero Trust → Access → Applications → Add an application → Self-hosted**:

- **Application domain:** `astro.midnightpoetry.studio`, **path** `admin*`
- **Policy:** Allow, **Emails** = the staff addresses. **Session duration:** 8 hours.

Staff then sign in to Astro itself, where an authenticator app is required. Plan 4 will add the step to make yourself the first administrator.

## 15. After the first deploy: checks

All of these are done in a browser.

**Landing page:**

- [ ] `https://astro.midnightpoetry.studio` loads.
- [ ] At **securityheaders.com**, scan `https://astro.midnightpoetry.studio`: grade **A**, with Content-Security-Policy and Strict-Transport-Security listed.
- [ ] On a phone: nothing scrolls sideways, and the cards fit.
- [ ] With **Reduce Motion** on (iPhone: Settings → Accessibility → Motion), nothing animates and every section shows.
- [ ] Using only the keyboard, the first Tab shows "Skip to content".

**App:**

- [ ] Cloudflare → `astro-app` → **Deployments** → latest build log shows `migrations: N applied` before the deploy.
- [ ] Sign up, confirm the email (it arrives from your Resend domain), turn on 2-step sign-in, sign out, and sign back in with a code.
- [ ] The Turnstile check appears on sign-up, sign-in and a guest's first draw.
- [ ] Draw today's card as a guest and as a member. Drawing again the same day returns the same reading.
- [ ] After a reading, the Verify screen shows "Matches ✓".
- [ ] At **securityheaders.com**, scan `https://astroapp.midnightpoetry.studio/today`: Content-Security-Policy is listed and contains `nonce-` and `frame-ancestors 'none'`.
- [ ] **Workers Free check:** a day after launch, open Cloudflare → `astro-app` → **Observability**. CPU time per request should stay under 10 ms for sign-in and the main pages. If it regularly doesn't, upgrade to Workers Paid (step 9).

**Paid readings and admin** *(plans 3–4)*:

- [ ] Buy an AI reading in Stripe test mode; it appears in the journal and the admin portal.
- [ ] Open `/admin` in a private window: Cloudflare Access blocks it.
- [ ] Have the privacy notice and terms reviewed before public launch (`/terms` and `/privacy` don't exist yet).

## 16. Rolling back

- **A Worker:** Cloudflare → the Worker → **Deployments** → pick the previous version → **Rollback**. Instant, no rebuild.
- **The database:** updates aren't undone automatically. They're written so the previous app version still works with them. If data must be restored, use Neon → **Restore** (to a point in time) or the branch you made before a big change.

## Release safety

- GitHub holds no deploy or database passwords. Its only job is running tests on pull requests.
- Cloudflare and Neon passwords live only in Cloudflare (build secrets, Worker secrets, Hyperdrive).
- Builds install only the exact package versions in the lock file. Dependabot proposes updates weekly as pull requests.
- Workers answer only on their real addresses (no `workers.dev` or preview addresses).
- Non-production branch builds stay off for any Worker whose build holds the migrator password.
- Development shortcuts (fake email, Turnstile off, leaked-password check off) are refused by the app on its real address.
- Passwords are stored as bcrypt (strength 12) over a SHA-256 of the password, computed inside the database. The password travels only over the encrypted Hyperdrive connection.
- Deck orders, orientations and salts never leave the server until a reading is complete; tests check for leaks.
- Developer setup and commands are in `docs/DEVELOPMENT.md`; they aren't needed to deploy.
- To do: pin GitHub Actions to exact commit SHAs.
