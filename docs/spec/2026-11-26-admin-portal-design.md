# Plan 3 design: the admin portal

Status: draft for the owner's approval, 26 Nov 2026. It builds on the summary spec (`docs/spec/2026-11-24-astro-design.md`) and the build plan doc. The screen mockups are added to the canvas before any code.

## Intent

The owner runs Astro without a developer for day-to-day changes. That means:

- editing any wording on the landing page, in the app, in emails, and in the card meanings;
- choosing the AI provider and entering its key;
- adjusting settings;
- helping users;
- inviting people when needed.

Paid AI readings (Plan 4) need all of this first, so the admin portal comes before payments.

**Success:** at launch the owner can change any sentence a visitor sees (app wording live within about a minute, landing page wording within about five), set up the AI provider and key without touching Cloudflare, and nothing in the portal can be reached by anyone who wasn't invited.

## Goals

1. **The admin portal:** a third Worker at `astro.midnightpoetry.studio/admin`, behind Cloudflare Access, with its own sign-in. Staff must use an authenticator app.
2. **Roles:** `owner`, `admin` and `moderator` in the portal, plus `reader` in the app. Accounts are invite-only, and signing up on the app never grants a role.
3. **Text editing:**
   - all wording on the landing page, in the app and in emails;
   - the card meanings (owner only);
   - each change saved as a draft, which can be checked, published, and restored from history.
4. **AI settings:**
   - services from Anthropic, OpenAI, Google Gemini, or any service with an OpenAI-compatible API, each with its model and an encrypted, write-only key;
   - three roles (writer, checker 1, checker 2), each with a main service and at least two fallbacks, always three different companies per reading;
   - a "Test connection" button;
   - a daily spending cap and AI orders per person per day, stored now and enforced in Plan 4.
5. **Site settings:** contacts, social links, disclaimers, reversal rate, daily limits, maintenance mode.
6. **Users:** look someone up by email, see account status, disable or re-enable the account, and reset 2-step sign-in.
7. **Audit log:** every change made in the portal, append-only.
8. **Dashboard:** sign-ups, readings and active users, today and over 7 days.

## Non-goals (this plan)

- **Payments, prices and orders:** Pricing, Orders and refunds come in Plan 4 with Stripe.
- **AI readings:** generated in Plan 4. Plan 3 only stores the settings and tests the connection.
- **Human readings:** the readers' Requests area in the app and the admin Requests queue come in Plan 4. Plan 3 can invite readers, but they have nothing to do yet.
- **Card art upload:** a later plan.
- **Ownership transfer:** Plan 3 has one owner. Transferring ownership comes later.
- **Translations:** English only.

## Anti-goals (would be a failure even if it works)

- Anything typed in the portal running as code on the live site. All text is plain text, inserted escaped.
- The AI key readable by anyone, including the owner, after it's saved, or present in logs, the browser, or a database dump on its own.
- A way into the portal or a role without an invitation, or a portal action without 2-step sign-in.
- The landing page running a Worker on each visit, becoming slower, or ever showing old wording because something was unreachable.
- Staff being able to read users' journal notes or check-in notes.

## Constraints

- **Hosting:** Workers Free (10 ms CPU per request, 100,000 Worker requests per day across the account). Static asset requests are free and unlimited, so the landing page must stay pure static files (owner, 26 Nov).
- **Deploy:** browser-only (`docs/DEPLOYMENT.md`). New Cloudflare pieces must be creatable in the dashboard.
- **Release process:** as before. Workers Builds deploys and migrates; migrations are expand-then-contract; GitHub holds no secrets.
- **Security:**
  - least-privilege database roles;
  - Zod on every input;
  - same-origin checks on every write;
  - a strict CSP on every host;
  - Turnstile on sign-in forms.

## Approaches considered

How edited text reaches live pages. The landing page must stay pure static files with no Worker on each visit (owner, 26 Nov), so the landing page and the app are handled differently:

| | Approach | Trade-off | |
| --- | --- | --- | --- |
| **Rebuild on publish** | Publishing landing text triggers Cloudflare to rebuild the landing page with the new wording built in (a Workers Builds Deploy Hook). The app reads published text from the database in requests it already serves. | Landing stays free, unlimited and as fast as today; landing changes take about 5 minutes to go live. App changes go live within a minute at no extra cost. | **Chosen** |
| Swap text in as the landing page is served | The landing Worker inserts published text from KV on each visit. | Every landing visit would run a Worker and count toward 100,000 requests a day. | Rejected by the owner |
| Server-built landing page | The landing page reads text from the database on each visit. | Same Worker cost, plus a rewrite and database access for the landing page. | Rejected |
| Text loaded in the browser | The page fetches wording after it loads. | Old wording flashes; search engines may index it. | Rejected |

Also decided: AI keys are entered in the portal, not as Cloudflare secrets (owner, 26 Nov), with the safeguards below.

## Design

### 1. Admin Worker and sign-in

- **App:** a new `apps/admin` (Next.js 16 on OpenNext), Worker `astro-admin`, route `astro.midnightpoetry.studio/admin*`. `basePath: "/admin"`.
- **Cloudflare Access** covers `/admin*` and allows only staff email addresses. It's the first gate; Astro's own sign-in is the second.
- **Sign-in:** the portal runs its own Better Auth instance on the same account tables and the same `BETTER_AUTH_SECRET`. One account and one authenticator work in both places.
  - Cookies are scoped to the admin host and `/admin`, with prefix `astro-admin`.
  - Each session records the surface it was made on (`app` or `admin`). The admin portal accepts only `admin` sessions, and the app accepts only `app` sessions.
- **Who can sign in:** only accounts with an active `owner`, `admin` or `moderator` role. Everyone else gets the same generic "email or password is wrong" message as a wrong password.
- **2-step:** a staff account without an authenticator can't do anything except enrol one.
- **Sessions:** last 8 hours.
- **Step-up:** these actions ask for a fresh authenticator code, valid for that one action:
  - changing AI settings or the key;
  - changing roles, inviting or removing people;
  - disabling a user or resetting their 2-step;
  - publishing card meanings;
  - restoring an old version.
- **Database:** a new role `astro_admin` connects through a second Hyperdrive configuration (`astro-admin`, caching off). Its grants:
  - read and write on the content, settings, staff and invite tables;
  - read on users and sessions, plus update of the disabled flag;
  - `INSERT` only on `audit_log`;
  - no DDL.

### 2. Roles and invitations

Access matrix (owner-approved, 26 Nov):

| | Owner | Admin | Moderator | Reader (app) |
| --- | --- | --- | --- | --- |
| Card meanings | Edit, publish | View | — | View |
| All other text, site settings | Edit, publish | Edit, publish | — | — |
| AI provider, key, caps | Edit | — | — | — |
| Invite and remove people, change roles | All roles | Moderators and readers | — | — |
| Users: look up, disable, reset 2-step | Yes | Yes | Yes | — |
| Requests *(Plan 4)*: watch, reassign, refund | Yes | Yes | Yes | Own requests only |
| Audit log | View | View | — | — |
| Dashboard | Yes | Yes | Yes | — |

- **Tables:**
  - `staff_role(user_id, role, granted_by, granted_at, revoked_at)` — one active role per person;
  - `invite(id, email, role, token_hash, invited_by, expires_at, accepted_at, revoked_at)`.
- **Inviting:**
  - The portal emails a link valid for 72 hours. Only the SHA-256 of the token is stored.
  - Staff links open the portal; reader links open the app.
  - The person signs in to an existing account with that email, or sets a password if there isn't one (no Turnstile skip; same password rules as the app). They then enrol an authenticator, and only then does the role become active.
- **Protections:**
  - Re-inviting, revoking or changing a role is logged.
  - There's always exactly one owner: the owner's role can't be removed, and nobody can grant `owner` in Plan 3.
  - An admin can't change another admin or the owner.
  - Removing a role revokes that person's portal sessions immediately.
- **First owner:** the owner signs up on the app as usual and confirms the email. Then, in Neon's SQL Editor, they run one documented statement that inserts the `owner` role. This works only while no owner exists: a unique partial index enforces one owner.

### 3. Text editing

**What's editable.** Every visible string, grouped into keys:

- Landing page: `landing.*`, from `apps/landing/content/site.ts`.
- App: `app.*`, extracted from components into a catalogue.
- Emails: `email.*`, from `mail-templates.ts`.
- Patterns sentences: `patterns.*`.
- Card meanings, edited on their own screen.

The text in the code becomes the **default** for each key. The portal stores only overrides.

**Catalogue.** A new package `@astro/copy` defines every key with:

- its default text;
- where it appears (surface, screen, a short description for the editor);
- a maximum length;
- the placeholders it must keep (for example `{name}`, `{count}`).

On publish, each override is validated:

- plain text, line breaks allowed, no HTML;
- within the maximum length;
- exactly the same placeholders as the default.

**Storage (database only, no KV).**

- `text_override(key, value, updated_by, updated_at)` holds drafts.
- `text_version(id, kind ('landing'|'app'|'meanings'), snapshot_json, published_by, published_at, note)` holds every published version. A snapshot holds only overrides.

**Publishing.** Validate, write a `text_version` row, audit-log it. **Restore** publishes an older version's snapshot as a new version.

**Landing page: rebuilt on publish.**

- The landing page stays pure static files. No Worker runs when someone visits.
- `astro-landing` gets a **Deploy Hook** (Cloudflare dashboard → the Worker → Settings → Builds → Deploy Hooks, branch `main`). Its URL is stored as the Worker secret `LANDING_DEPLOY_HOOK_URL` on `astro-admin` only. The URL itself is the credential: anyone with it can trigger a build, so it's never shown in the portal.
- Publishing landing text calls that URL. Cloudflare rebuilds the landing page, which takes about 5 minutes, and the portal says so.
- **The build reads the published wording** from a public, read-only endpoint on the app: `GET https://astroapp.midnightpoetry.studio/api/copy/landing`. That wording is public anyway once published. The endpoint returns the latest landing snapshot and its version id, and is rate-limited and cacheable.
  - The build writes the wording into the pre-built pages.
  - Every build does this, including normal code deploys, so a code change never reverts published wording.
- **If the endpoint can't be reached,** the build fails and the current landing page keeps serving. It never silently falls back to default wording. An empty response ("nothing published yet") is fine: the defaults are used.
  - For the very first landing build before the app exists, the build variable `COPY_SOURCE=defaults` allows building with defaults. It's removed once the app is live.
- **Publishing is limited** to once every 2 minutes, to group edits and stay well within Cloudflare's build limits.
- The portal shows when landing text was last published and the deploy hook's response. The landing page's footer carries the text version id, so you can see which version is live.

**App and emails: live.**

- App pages already run the app Worker, so reading wording in the same request adds no Worker requests.
- Server components read the published app snapshot through a cached helper (`getCopy()`, cached in memory for 60 seconds). Client components receive their strings as props.
- Emails read the snapshot when sent.

**Checking before publishing.**

- **App text:** "Preview" saves the draft as a preview with a random 128-bit id, valid for 30 minutes. It opens the app with `?astro-preview=<id>`. Those pages send `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and show a "Preview, not live" bar.
- **Landing text:** there's no Worker to render a draft, so the editor shows each landing string in a simple version of its section, at phone and desktop widths, with character counts. After publishing, the live page updates in about 5 minutes. Restore is one click if it doesn't read well.

**Card meanings.** Same mechanism with their own snapshot kind, `meanings`, read live by the app. Only the owner can publish. The Card library screen shows the default beside the override for each field.

**Workers Free budget.** No extra Worker requests: the landing page stays static, and the app reads wording within requests it already serves. Each landing publish uses one Workers Builds build.

### 4. AI settings: services, roles, fallbacks and the encrypted key

**How readings will be checked (owner, 26 Nov; generated in Plan 4).** Every AI reading uses three different AI companies:

1. The **writer** drafts the reading.
2. **Checker 1** and **checker 2** each check the draft against the cards drawn, the published card meanings and the safety rules (no medical, legal or financial advice; no claims the cards don't support). Each replies "pass" or "fix this" with notes.
3. If either flags a problem, the writer revises once with their notes, and both check again.
4. If it still fails, the user sees a calm "we couldn't complete this reading" message and isn't charged.

The reading is shown only after it passes.

**Services.** Table `ai_service` holds one row per AI service the owner adds:

- the provider: `anthropic`, `openai`, `gemini`, or `openai_compatible`;
- the display name;
- the company it belongs to, used for the "three different companies" rule. It's fixed for the first three providers and typed by the owner for `openai_compatible`;
- the base URL (`openai_compatible` only; must be `https://` with a hostname, not an IP address; the Worker's `global_fetch_strictly_public` flag also stops calls to private networks);
- the model;
- `key_ciphertext`, `key_iv`, `key_last4`;
- whether it's switched on;
- max output tokens, temperature, timeout;
- `updated_by`, `updated_at`.

**Roles and fallbacks.** Table `ai_role_slot(role, position, service_id)` defines an ordered list for each role:

- the roles are `writer`, `checker_1` and `checker_2`;
- position 0 is the main service, and 1 and 2 are the fallbacks (more allowed).
- Every role needs a main service and **at least two fallbacks**. AI readings can't be switched on until all three roles meet this and every service in them has passed a test.

**When a fallback is used.** The next service in a role's list is tried when the current one:

- times out;
- returns a server error;
- reports that its quota or credit is used up (HTTP 402 or 429, or the provider's "insufficient quota" error);
- has a rejected key.

A service that fails is skipped for 10 minutes. Errors are recorded per service and shown in the portal.

**Three different companies, every time.**

- While building a reading, a service whose company is already used for another role in that reading is skipped, and the next fallback is tried.
- If a role runs out of services, the reading fails gracefully, as in step 4.
- The portal warns when the setup is fragile, for example when only three companies are configured, because one outage would then stop AI readings. Four or five companies keep readings running through an outage.
- **Note:** a service such as OpenRouter can resell another company's models. The company field is what the rule uses, so the portal asks the owner to name the real company behind each `openai_compatible` service.

`app_setting` holds:

- the daily spending cap, which counts every call (writer, checkers, revisions and fallbacks);
- AI orders per person per day.

**Encryption:**

- AES-256-GCM using a master key from a new Worker secret, `AI_KEY_ENCRYPTION_KEY`. It's 64 hex characters, generated in the owner's password manager, and set on `astro-admin` (to encrypt) and on `astro-app` (to decrypt, in Plan 4).
- A random 96-bit IV per key, with the row id as associated data, so a ciphertext can't be moved to another row.

**Write-only:**

- The portal never returns the key. It shows the provider, model and "Key ending in `abcd`".
- Replacing a key needs a step-up code.
- The plaintext exists only in the request that saves it, and in Plan 4 in the request that calls the provider.

**Test connection:**

- Each service has its own Test button, and "Test all" runs every service in the three roles.
- The admin Worker decrypts the key and sends a one-line prompt through Cloudflare AI Gateway (`astro`) where the provider is supported; `openai_compatible` services are called directly.
- It reports success, the time taken, and the provider's error message with any key text removed.
- Limited to 10 tests per hour.

**Alerts:** every key change emails the owner (Resend) and is audit-logged, without the key.

### 5. Site settings, Users, Dashboard, Audit log

- **Site settings:** existing `app_setting` rows plus contacts, social links, disclaimers, daily limits and maintenance mode. Each is validated with Zod and audit-logged. Maintenance mode shows a calm "back soon" page in the app to everyone except staff.
- **Users:**
  - Search is by exact email only, so there's no browsing the user list.
  - A profile shows: created date, email verified, 2-step on, last sign-in, number of readings, and disabled state.
  - No journal notes, check-in notes or reading contents.
  - Disabling revokes the person's sessions and blocks sign-in. Re-enabling restores access. Resetting 2-step removes their authenticator and backup codes and revokes sessions.
  - All of these are audit-logged.
- **Dashboard:** counts only (sign-ups, readings by spread, active users, checks-ins answered), today and over 7 days, from aggregate queries. It also links to Cloudflare's Workers analytics, where the day's request count is shown. Reading that count inside the portal would need another Cloudflare API key, so it isn't built in.
- **Audit log:**
  - `audit_log(id, actor_id, actor_role, action, entity, entity_id, summary_json, ip_hash, at)`.
  - `astro_admin` and `astro_web` can only `INSERT`, and a trigger rejects `UPDATE` and `DELETE`.
  - The summary never holds secrets or full text bodies, only key names and lengths for text changes.
  - It can be filtered by person, action and date.

### 6. Screens (mockups first)

The existing canvas has Admin Dashboard, Requests, Pricing, AI, Cards and Settings.

**Changes:**

- **AI settings:** reworked for provider choice, base URL, key entry (write-only, last 4 shown) and test connection.
- **Navigation:** Requests, Orders and Pricing are hidden until Plan 4.
- **Cards:** default and override shown side by side, publish for the owner, view-only for others.

**New screens:**

- **Text:** a list grouped by surface and screen, with search, an editor showing the default, character count, placeholder checks, Save draft, Preview and Publish, and a history panel with Restore.
- **Team and roles:** people, roles, pending invites, Invite, remove.
- **Accept invite:** in the portal and in the app.
- **Users:** search by email, profile, Disable, Reset 2-step.
- **Audit log.**
- **Admin sign-in:** with the authenticator step.
- **Step-up code prompt.**

All screens follow the existing admin style: dark Night/Ink, gold hairlines, Inter UI with Cormorant headings, 8 px grid, WCAG 2.2 AA.

### 7. Delivery

The plan is delivered in two pull requests, each tested and mergeable on its own:

1. **3a: portal foundations.**
   - Admin Worker, sign-in with surfaces, roles and invites;
   - audit log, Users, Site settings, AI settings with encryption and test connection, Dashboard;
   - the `astro_admin` role and Hyperdrive;
   - deployment guide steps.
2. **3b: text editing.**
   - `@astro/copy` catalogue;
   - extracting app and email strings;
   - landing wording built from the published snapshot, the Deploy Hook and the `/api/copy/landing` endpoint;
   - publish, preview (app) and restore;
   - Text and Card library screens.

## Left to the builder

These are decided by Claude during planning, as long as they stay within the design above:

- exact key names and grouping in `@astro/copy`;
- component structure;
- the form library;
- how dashboard counts are queried;
- exact Zod schemas.

## Calls Claude made (owner may check)

- The admin sign-in shares accounts and `BETTER_AUTH_SECRET` with the app, kept apart by session surface.
- An app preview link works through an unguessable id that expires in 30 minutes, instead of a signed token. This avoids another secret.
- The first owner is set with one SQL statement in Neon's SQL Editor, guarded by a one-owner index.
- The Users screen searches by exact email only.
- A landing build fails, rather than using default wording, if the published wording can't be fetched.
- Landing publishes are limited to once every 2 minutes.
- Whether the AI Gateway requires its own access token (an "authenticated gateway") is settled in Plan 4, when readings are generated. Plan 3's test calls are rare and rate-limited.
