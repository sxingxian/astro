# Plan 4, Part 1: app layout, fan picker, legal pages and readers — design

Status: draft for the owner's approval, 27 Nov 2026. Builds on `docs/spec/2026-11-24-astro-design.md` and `docs/spec/2026-11-26-admin-portal-design.md`. Mockups (approved by the owner on 27 Nov "for now"): https://claude.ai/artifact/BFRgaSVWbDGULjyxKX9gC9, page "Ask, readers, desktop (27 Nov)".

## 1. Intent

Plan 4 brings paid readings (by AI or by a real reader). The owner split it into two parts, each its own pull request:

- **Part 1 (this design):** everything that doesn't need payments. The app gets its final shape (fan picker, reversed cards, desktop layout, Ask tab, in-app legal pages, no exits to the landing site), and readers can exist (invited or offered the role, with their own private log of outside readings).
- **Part 2 (designed later):** paid AI readings and paid readings by real readers: Stripe, the AI writer and two checkers, refunds, the Reader desk's requests, holds, deadlines, reply checking, and reader payouts (owner, 27 Nov: Stripe for paying; readers can be paid through Stripe Connect or manually, both supported).

Why Part 1 first: today's users get the new picker and layout straight away, every Part 2 screen is built on the final layout, and the owner can invite and try readers before any money moves.

## 2. Goals, non-goals, anti-goals

**Goals**

1. The fan-out picker replaces the flat strip everywhere cards are picked.
2. A reversed card is shown upside down, everywhere a card is shown.
3. A desktop layout (≥ 1024 px) for every app screen; phones keep the bottom tabs.
4. The app never sends anyone to the landing site; a test fails the build if it does.
5. "Go deeper" becomes an "Ask" tab with a Coming soon page.
6. Terms and Privacy are app pages, edited in the admin portal with a Notion-style editor, with drafts, preview, publish, history and restore like all other text.
7. Readers: an owner or admin invites someone as a reader, or offers the reader role to an existing account; the person accepts and turns on an authenticator. The role can be held alone or beside a portal role.
8. Readers keep a private log of readings they did outside the app.
9. Two hardening items from the Part B review: email wording can't carry links, and invisible or direction-changing characters are refused in all wording.

**Non-goals (Part 2 or later):** payments, AI readings, reader requests and the request queue, holds and deadlines, reply checking, payouts, a waitlist, real legal wording (the owner provides it; see §8).

**Anti-goals (failure even if it works):**

- Anyone becoming a reader without an owner or admin starting it, or without accepting and turning on an authenticator.
- Anyone but the reader seeing a reader's log, including the owner, admins and moderators, and including through exports, the audit log, AI or support tools.
- Any HTML stored or rendered from editable text (legal pages included).
- A Worker running on each landing page visit (the landing page stays static).
- Animation that ignores Reduce Motion, or a picker that only works with a finger.

## 3. Constraints

- Cloudflare Workers Free: 10 ms CPU per request, Worker size limit. The portal's editor loads only on the screen that uses it.
- Security first: server-side checks for every permission; least-privilege database users (`astro_web` for the app, `astro_admin` for the portal).
- Every piece of visible text is editable in the portal (Text screen), including the new screens' wording.
- Deployment stays browser-only; Cloudflare runs builds and migrations.
- Accessible: keyboard and screen reader for the picker, editor and log; touch targets ≥ 44 px; Reduce Motion respected.
- Consistent with the existing design language (Night/Ink, gold hairlines, Cormorant headings, Inter UI) and the approved mockups.

## 4. Approaches considered (owner's choices)

| Decision | Options | Chosen |
| --- | --- | --- |
| Order of Plan 4 | One plan; four parts; two parts | **Two parts** (owner): layout + readers, then payments |
| Ask tab before payments | Hide until Part 2; Coming soon page | **Coming soon page** (owner) |
| Reversed cards | Turn the whole card; turn only the art (today) | **Whole card upside down** (owner) |
| Legal pages | Fixed headings with one box each; one long entry per page | **One long entry per page** (owner) |
| Editor | Plain text box with formatting codes; BlockNote; Tiptap | **Tiptap 3, the same set-up as the owner's `theseahfamily` and `sxingxian` projects** (owner): slash menu, formatting bubble, drag handle, placeholder; saved as a checked block document, rendered as React, never HTML |
| Card picker | Wheel, rolodex, table spread, cut and deal, fan out | **Fan out**, 115 px edge zone (owner, 27 Nov) |
| Reader log on role removal | Delete; export then delete; lock | **Lock** (kept, unviewable); giving the role back unlocks it (owner) |
| Who gives staff the reader role | Owner may self-add; only someone else; owner grants every staff reader role | **Only the owner gives the reader role to staff, including themselves**; admins offer it to ordinary users only (owner) |
| Offers to existing accounts | Reader role only; reader role and/or a portal role | **Reader role, a portal role, or both** in one offer, as in mockup M1 (owner) |
| Reader's log privacy | Ordinary table, kept out of the app and portal; encrypted in the reader's browser | **Ordinary table, honest wording** (owner): "Private to you. Astro staff can't see it in the app or portal." |
| Legal pages in the text system | Inside the `app` wording set; one `legal` set; each page its own set | **Each page its own set** (Claude's call): Terms, Privacy and Reader guidelines publish, preview and restore on their own, so an app-wording publish or restore never touches them, and "Last updated" is that page's own publish date |

## 5. Design

### 5.1 App layout and navigation

- **Phone (< 1024 px):** bottom tabs **Today · Ask · Journal · Account**. Readers get a fifth tab **Desk**. Patterns stays inside Journal (as today).
- **Desktop (≥ 1024 px):** a left side menu (Today, Ask, Journal, Patterns, Account; a "Reader" section with **My log** for readers), content in up to two columns, max width about 1100 px (mockups D1–D4). Every existing screen gets a desktop arrangement; reading pages show the cards beside the meaning.
- **No exits to the landing site:** the "Go deeper" link, and the sign-up page's Terms and Privacy links, now point inside the app. An automated test scans the app's source and built pages and fails if any link points at `astro.midnightpoetry.studio` (the landing host). Links from the landing page *to* the app are fine; the landing footer's Terms and Privacy links (which go nowhere today) point to the app's pages.
- All new wording (tabs, menu, Coming soon, Desk, log, legal page chrome) is added to the catalogue, so it's editable in the Text screen.

### 5.2 Ask: Coming soon

A page at `/ask` (mockup A1's look): what's coming (ask one question; answered by AI, checked by two more AIs, or by a real reader), and:

- guests: a sign-up prompt;
- signed-in people: a short "We'll let you know when it opens" note. No waitlist and no new data collected.

### 5.3 Fan-out picker

Replaces the flat strip (`components/draw/Fan.tsx`) for the daily one-card draw (78 cards) and both stages of the three-pair draw (22 Majors, then 56 Minors). Behaviour as approved in the "Option 5 · Fan out" prototype:

- The shuffled deck fans out like a hand of cards, wider than the screen so cards aren't thin (about 3° apart for 78, 3.3° for 56, 5.5° for 22).
- Slide a finger across: the card under it lifts and its neighbours part. Lift the finger: the card stays raised; tap it to pick. Mouse: hover lifts, click picks.
- **Edge zone 115 px:** within 115 px of the left or right edge, the fan slides that way, starting at a steady speed and speeding up nearer the edge; a fade and arrow show there are more cards that way, and the edge glows while sliding. (The prototype's "Tune edges" panel is not built.)
- Keyboard: arrow keys move along the fan (it slides to keep the card in view), Enter picks. Screen readers hear "Card N of M".
- Reduce Motion: no fan-out animation and no sliding motion (the fan jumps to keep the focused card in view).
- Built with GSAP (already in the project), transforms and opacity only; cards outside the visible arc aren't drawn.
- Unchanged: the server shuffles, the fingerprint shows before the pick, the browser only ever sends a position.

### 5.4 Reversed cards

- A reversed card is drawn **upside down as a whole** (numeral, art and name), the way it would lie on a table. The flip-over reveal ends with the card settling upside down; Reduce Motion shows it upside down with a crossfade.
- A small **"Reversed"** label (editable wording) sits under the card, outside it, so nothing has to be read upside down. Screen readers keep hearing "The Star, reversed".
- Everywhere a card is shown: reveals, readings, journal, check-ins, Patterns, verify, and later Ask and the reader's log.

### 5.5 Terms and Privacy

**In the app:** `/terms` and `/privacy`, public (no sign-in), with the page wording, "Last updated" (the date that page's wording was last published), and the normal app layout.

**Saved format:** each page is one catalogue entry of a new kind, a **document**: `{ v: 1, blocks: [...] }`, checked against a strict schema (modelled on `theseahfamily`'s `app/lib/story-doc.ts`):

- blocks: paragraph, heading (h2), subheading (h3), bulleted list, numbered list, quote, callout (note), divider;
- inline: text with bold and italic, and links that are `https://` or `mailto:` only (checked with the same rule as `theseahfamily`'s `safeHref`);
- limits: e.g. 400 blocks, 60,000 characters, 160 kB of JSON (exact numbers left to the plan);
- anything else is refused when saving a draft and again when publishing; the app renders documents as React elements, never as HTML.

The documents live in the existing text system, **each page as its own published set** (new kinds `terms`, `privacy` and `guidelines`; Claude's call). Drafts, Preview in the app, Publish (live within a minute), History and Restore work as for other wording but per page: publishing app wording never publishes a half-edited legal draft, restoring app wording never reverts a legal page, and the app reads a page's document only on that page (not on every request). Every check runs on the server.

**In the portal:** the Text screen gets a **Legal** tab listing Terms, Privacy and Reader guidelines (§5.7). Choosing one opens the **Tiptap 3 editor**, set up like the owner's other projects: type `/` for the block menu, Markdown shortcuts (`## `, `- `, `1. `, `> `), a formatting bubble on selected text (bold, italic, link), drag handles to reorder blocks, and a placeholder on empty lines. The editor converts to and from the saved format in the browser, so the stored data doesn't depend on Tiptap. Pasted content is fitted into the allowed blocks; images, tables, scripts and styles are dropped. The editor is loaded only on the Legal tab.

**Default wording:** clearly marked placeholder text ("Replace this with your terms…"), with a check in `DEPLOYMENT.md` that both pages are replaced and reviewed before public launch.

### 5.6 Hardening from the Part B review

- **Email wording can't carry links:** overrides of `email.*` entries are refused if they contain a web address (`http`, `https`, `www.` or a domain-like word). Links in emails only ever come from the system (the `{url}`-style placeholders filled by the server).
- **Invisible and direction-changing characters** (zero-width characters, bidirectional overrides and isolates, line/paragraph separators, other C1 controls) are refused in every override, at save, at publish and in the landing build.

Other minor review items stay deferred (listed in the project notes).

### 5.7 Readers

**Who can become a reader** (owner, 27 Nov): only through an owner or admin, in one of two ways:

1. **Invite by email** (exists today): the invite's role is `reader`. The person signs in or signs up with that email, turns on an authenticator, and accepts.
2. **Offer the role to an existing account** (new): from Team → "Existing account", or Users → "Offer a role". The person gets an email and an in-app prompt (mockup "Role offer"), turns on an authenticator if needed, and accepts. Offers expire (same as invites: 72 hours) and can be cancelled.

Both need a step-up code from the sender and are audit-logged.

**Who may give whom the reader role** (owner, 27 Nov):

- Only the **owner** gives the reader role to staff (admins and moderators), and the owner may add it to themselves (step-up code, audit-logged).
- **Admins** can offer or invite the reader role to ordinary accounts only (no portal role), and can't combine it with a portal role in one offer.
- **Moderators** can't grant the reader role.
- Removing: the owner can remove anyone's reader role; admins can remove it from ordinary accounts only; anyone can give up their own reader role from Account (Claude's call). Every removal is audit-logged and locks that person's log.

**Offers can carry a portal role too** (owner, 27 Nov; mockup M1's "Existing account" form): one offer can give the reader role, a portal role (moderator or admin), or both, under the same rules as invites today (admins offer moderator only; the owner offers admin or moderator; nobody offers owner). Accepting a portal role works like accepting an invite: an authenticator is required, and portal access starts after acceptance.

**Reader guidelines** (mockup "Role offer", step 3): accepting the reader role includes agreeing to the reader guidelines (no contact details, no medical, legal or money advice, reply within 48 hours). The guidelines are a third legal document, edited in the portal like Terms and Privacy. The app records which published version each reader accepted; when the guidelines are published again, readers must accept the new version before using Desk (Claude's call). Nobody can make themselves a reader: sign-up never offers a role, and the app's database user can only add a reader role through checked database functions (like `accept_invite` today) that verify the invite or offer, its expiry, the email/account match and that 2-step sign-in is on.

**Reader beside a portal role:** today `staff_role` holds one role per person. The reader role moves to its own grant (for example a `reader_role` table: user, granted by, granted at, revoked at), so any account can be a reader alone or alongside owner, admin or moderator. The portal's Team screen shows both (mockup M1: "Owner + Reader", reader-only people, "Add reader role", "Remove reader role", "Offer reader role again"). Staff who are readers can check and release their own work in Part 2 without a second person (owner, 27 Nov); every action is still audit-logged.

**Removing the reader role:** the person loses Desk and My log at once; their log is locked (§5.8). Removing a reader needs a step-up code and is audit-logged.

**In the app:** readers see the Desk tab (phone) or the Reader section (desktop). In Part 1 it holds **My log** and a note that requests arrive when paid readings open.

### 5.8 Reader's log of outside readings

For readers to record readings they did outside the app (mockups "Log list", "Log record", "Card chooser", D-Log).

**Each entry:** first name or nickname (no contact details), date, where (in person / online / event), question (optional), notes, a consent tick ("They agreed to me keeping this note"), and the spread:

- one card; or three cards laid out as "any cards from the deck" or "Major, then Minor clarifier";
- optional accompanying cards, attached to a position or to the whole reading;
- upright or reversed for every card; positions renamable (default Past, Present, Future).

Cards are chosen with a search box and suit tabs (Major Arcana, Wands, Cups, Swords, Pentacles).

**Privacy (owner, 27 Nov):**

- Only the reader role can open it, and each reader sees only their own entries. The owner, admins and moderators can't see entries or counts in the app or portal, even if they are readers themselves (they see only their own).
- The promise shown to readers is honest about what it covers (owner, 27 Nov): "Private to you. Astro staff can't see it in the app or portal." It's an ordinary database table; anyone with direct database access (Neon) could read it, so no stronger claim is made. Deleted entries can remain in Neon's restore history for its retention window; `DEPLOYMENT.md` notes this.
- Never sent to AI, never in the portal, the audit log (beyond "a reader exported their log", with no content) or support tools.
- The reader can export their own entries as CSV (cells that start with `=`, `+`, `-` or `@` are neutralised so spreadsheets don't run them) and delete any entry.
- Removing the reader role **locks** the log: kept, but nobody can view it; giving the role back unlocks it. Deleting the account deletes the log.
- Database: the log table is reachable only by the app's user, every query is filtered by the signed-in reader **and** an active reader role, and the portal's user has no access to it at all.

## 6. Data and security summary

- New tables (names left to the plan): reader role grants; role offers (hashed token, expiry, sender, account, reader role and/or portal role); reader guideline acceptances (reader, published version, time); reader log entries.
- New text kinds `terms`, `privacy`, `guidelines` (the text tables' kind check and grants extended).
- New checked functions for accepting a reader invite or offer; the app's user can execute them but never write role tables directly.
- Grants: `astro_admin` manages reader grants and offers but has **no** access to reader log entries; `astro_web` reads role grants, reads and writes only its own reader's log entries (filtered in every query), and executes the accept functions.
- All new routes check permissions on the server; reader-only pages and APIs refuse anyone without an active reader role.
- Legal documents and all other wording are validated server-side at save and publish; rendering never uses raw HTML.

## 7. Testing

Every change follows the project's test-first rule. At least:

- **Picker:** browser tests for pointer drag, edge sliding, keyboard picking and Reduce Motion; the server contract (positions only) stays covered.
- **Reversed:** a reversed card renders rotated with the label; screen-reader name unchanged.
- **No landing exits:** a test fails on any app link to the landing host.
- **Legal:** schema tests (allowed blocks, link rule, limits, refusals); round-trip editor ↔ saved format; publish shows on `/terms` and `/privacy`; no HTML rendered.
- **Hardening:** links refused in email overrides; invisible characters refused everywhere.
- **Readers:** invite and offer acceptance (expiry, wrong account, no authenticator, moderator can't grant, admins can't give staff the reader role, only the owner can self-add, the app's database user can't write role tables); offers with a portal role follow today's grant rules; reader + portal role together; guidelines must be accepted, and again after they change; role removal locks the log.
- **Log privacy:** other readers, staff and the portal's database user can't read entries; CSV neutralises formulas; account deletion removes entries.
- The full suite (lint, types, unit, database, browser tests for landing, app and portal) passes; default wording is unchanged except where this design changes it.

## 8. Open for the owner (not blocking Part 1)

- The real Terms and Privacy wording (to be pasted into the portal before launch; legal review recommended).
- Part 2 design: Stripe set-up, currencies (proposal SGD + USD), AI pipeline on Workers Free, reader payouts via Stripe Connect and/or manual.

## 9. Left to the builder

Exact table and column names, the document schema's numeric limits, GSAP easing values, how the desktop two-column split is arranged per screen (following D1–D4), the Coming soon page's exact wording (editable anyway), and how the editor's menus are styled within the portal's design language.
