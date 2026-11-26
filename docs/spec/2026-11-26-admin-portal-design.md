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

**Success:** at launch the owner can change any sentence a visitor sees and have it live within about two minutes, set up the AI provider and key without touching Cloudflare, and nothing in the portal can be reached by anyone who wasn't invited.

## Goals

1. **The admin portal:** a third Worker at `astro.midnightpoetry.studio/admin`, behind Cloudflare Access, with its own sign-in. Staff must use an authenticator app.
2. **Roles:** `owner`, `admin` and `moderator` in the portal, plus `reader` in the app. Accounts are invite-only, and signing up on the app never grants a role.
3. **Text editing:**
   - all wording on the landing page, in the app and in emails;
   - the card meanings (owner only);
   - each change saved as a draft, which can be previewed, published, and restored from history.
4. **AI settings:**
   - the provider: Anthropic, OpenAI, Google Gemini, or any service with an OpenAI-compatible API;
   - the model;
   - an encrypted, write-only key;
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
- The landing page becoming noticeably slower, or breaking when the text store is unavailable.
- Staff being able to read users' journal notes or check-in notes.

## Constraints

- **Hosting:** Workers Free (10 ms CPU per request, 100,000 requests per day across the account; KV allows 100,000 reads and 1,000 writes per day). Static asset requests are free and unlimited.
- **Deploy:** browser-only (`docs/DEPLOYMENT.md`). New Cloudflare pieces must be creatable in the dashboard.
- **Release process:** as before. Workers Builds deploys and migrates; migrations are expand-then-contract; GitHub holds no secrets.
- **Security:**
  - least-privilege database roles;
  - Zod on every input;
  - same-origin checks on every write;
  - a strict CSP on every host;
  - Turnstile on sign-in forms.

## Approaches considered

How edited text reaches live pages:

| | Approach | Trade-off | |
| --- | --- | --- | --- |
| **A** | The landing page stays pre-built. Its Worker swaps in published text from Cloudflare KV as the page is served. The app reads the same KV copy. | Landing stays fast and never needs the database; falls back to built-in wording if KV is unreachable. Every landing page view now runs the Worker (counts toward 100,000 requests a day). | **Chosen by the owner** |
| B | The landing page becomes server-rendered and reads text from the database. | A large rewrite of a finished page; the landing Worker would need database access, and each visit uses more CPU. | Rejected |
| C | The browser fetches text after the page loads. | Visitors see the old wording flash; search engines may index the old wording. | Rejected |

Also decided: text is edited live, not by republishing (owner, 26 Nov). AI keys are entered in the portal, not as Cloudflare secrets (owner, 26 Nov), with the safeguards below.

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

**Storage.**

- Database:
  - `text_override(key, value, updated_by, updated_at)` holds drafts;
  - `text_version(id, kind ('site'|'meanings'), snapshot_json, published_by, published_at, note)` holds every published version.
- KV namespace `ASTRO_TEXT`:
  - `site:published` and `meanings:published` hold the current published snapshot (only overrides, with a version id);
  - `preview:<random 128-bit id>` holds a draft snapshot for 30 minutes.

**Publishing.** Validate, write a `text_version` row, write the KV key, audit-log it. **Restore** publishes an older version's snapshot as a new version.

**Serving the landing page.**

- `astro-landing` gains a small Worker script that runs first for HTML pages only (`run_worker_first` for `/`). CSS, JS, fonts and images stay plain static assets, which are free.
- The pre-built HTML marks each editable element with `data-copy="landing.hero.title"`.
- The Worker fetches the page from its assets and reads `site:published` from KV, keeping a copy in the Cache API for 60 seconds per location. It then uses `HTMLRewriter` to replace the text of each marked element with `setInnerContent(value, { html: false })`.
- If KV fails or times out (300 ms), the page is served with its built-in wording.
- The Worker sets the same security headers as `_headers` and keeps the hashed-script CSP. Only text changes, never scripts.

**Serving the app.** Server components read the published snapshot through a cached helper (`getCopy()`, 60-second cache). Client components receive their strings as props. Emails read the snapshot when sent.

**Preview.**

- The editor's "Preview" button writes the draft snapshot to `preview:<id>` and opens the landing page or app with `?astro-preview=<id>`.
- Pages rendered from a preview id send `Cache-Control: no-store` and `X-Robots-Tag: noindex`, and show a "Preview, not live" bar.
- The random id is the only key to a preview, and it expires after 30 minutes.

**Card meanings.** Same mechanism with its own snapshot (`meanings:published`). Only the owner can publish. The Card library screen shows the default beside the override for each field.

**Workers Free budget.**

- KV reads: about one per location per minute for each of the landing page and the app.
- KV writes: one per publish or preview.
- Worker requests: each landing page view counts toward 100,000 a day across the account. At launch traffic this is far below the limit. Cloudflare's Workers analytics shows the daily count, and Workers Paid removes the limit if traffic grows.

### 4. AI settings and the encrypted key

**Table** `ai_setting` holds one row per provider configuration:

- the provider: `anthropic`, `openai`, `gemini`, or `openai_compatible`;
- the display name;
- the base URL (`openai_compatible` only; must be `https://` with a hostname, not an IP address; the Worker's `global_fetch_strictly_public` flag also stops calls to private networks);
- the model;
- `key_ciphertext`, `key_iv`, `key_last4`;
- whether it's the primary or the fallback;
- max output tokens, temperature, timeout;
- `updated_by`, `updated_at`.

`app_setting` holds the daily spending cap and AI orders per person per day.

**Encryption:**

- AES-256-GCM using a master key from a new Worker secret, `AI_KEY_ENCRYPTION_KEY`. It's 64 hex characters, generated in the owner's password manager, and set on `astro-admin` (to encrypt) and on `astro-app` (to decrypt, in Plan 4).
- A random 96-bit IV per key, with the row id as associated data, so a ciphertext can't be moved to another row.

**Write-only:**

- The portal never returns the key. It shows the provider, model and "Key ending in `abcd`".
- Replacing a key needs a step-up code.
- The plaintext exists only in the request that saves it, and in Plan 4 in the request that calls the provider.

**Test connection:**

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
   - landing `data-copy` markers and the HTMLRewriter Worker;
   - KV, publish, preview and restore;
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
- A preview link works through an unguessable id that expires in 30 minutes, instead of a signed token. This avoids another secret.
- The first owner is set with one SQL statement in Neon's SQL Editor, guarded by a one-owner index.
- The Users screen searches by exact email only.
- KV timeouts fall back to built-in wording after 300 ms.
- Whether the AI Gateway requires its own access token (an "authenticated gateway") is settled in Plan 4, when readings are generated. Plan 3's test calls are rare and rate-limited.
