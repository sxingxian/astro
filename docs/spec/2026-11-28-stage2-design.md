# Free-plan Stage 2: the reader pages, the old app retired, and a polish pass

Date: 28 Nov 2026. Status: approved 28 Nov 2026.
Mockups: "Astro — Screen Mockups" canvas, page **Stage 2 polish (28 Nov)** (13 screens, plus the layout, button,
loading and wording rules and the audit list).

## Why

Stage 1 moved the everyday screens to `astro-api` and brought every request under the Workers Free CPU limit. Two
things are left:

1. **The rest of the move** (from the free-plan design, stage 2): Desk and My log, invite, offer and reader
   guidelines still run on the old Next.js Worker (`astro-app`) behind the `LEGACY` binding, and `astro-app` is also
   where database migrations run. Until these move, the old Worker can't be retired.
2. **The owner's request (28 Nov):** fix the misaligned elements, how loading feedback works, the phone layout,
   standardise where buttons go so nothing is crowded, and clean up the English, across every screen.

## What the audit found

42 screens at 360, 768 and 1280 px (122 screenshots) and all 566 lines of wording. The 15 findings are on the
canvas (orange note). The ones that shape the design:

- **Every link reloads the whole page.** `apps/web` links are plain `<a href>`, so each tap throws the app away and
  shows a blank dark screen until `/api/session` answers. This is the main cause of the "loading feedback" problem.
- **No shared frame.** Each screen sets its own width and left edge (desktop content starts anywhere from 594 to
  645 px), only Today has a phone top bar, and draw headings are centred while other screens are left-aligned.
- **No button rule.** Some cards stretch buttons full width (Account on desktop), others use label width; on a
  360 px phone Today squeezes text and a button into one row until the text wraps one word per line.
- **Wording drift:** four names for signing up, a reader area called Desk on phones and My log on desktop, comma
  splices, `0 of 1 readings`, card meanings that repeat a sentence.

## Approaches

**Loading and navigation** (the only choice with real alternatives):

1. **In-app navigation (recommended).** Links become router links. The frame (top bar, tabs, side menu) and the
   session stay in memory; only the screen's own data loads, behind a thin progress line and, if slower than
   150 ms, a skeleton shaped like the screen. Cheapest on the Worker too: one `/api/session` per visit, not per tap.
2. **Keep full reloads, cache the session in the browser** so the frame can paint before `/api/session` answers.
   Still a white flash and a re-download of the app on every tap, and a stored session copy to keep in step.
3. **Server-rendered frame.** Brings back server rendering, which the free-plan design removed for CPU reasons.

**Everything else** has one sensible way: one shared frame and page header, one card and button standard, applied
to every screen including the rebuilt reader pages, so they are built once in the new style rather than ported and
restyled.

## The standard (summary; the canvas has the full rules)

- **Frame.** Phone: 56 px top bar on every screen (logo on top-level screens; back arrow and screen name on deeper
  ones), bottom tabs, 20 px sides, content ends clear of the tabs. Desktop (1024 px and up): side menu, one content
  column at the same left edge everywhere, max 960 px. Not-found, invite and offer pages get the frame and the
  star logo.
- **Page header.** Eyebrow, title, at most one action, lined up with the title. Left-aligned everywhere, the draw
  screens included.
- **Cards.** Header, text, then actions at the bottom. Cards in a row are the same height.
- **Buttons.** At most one gold button per card; second choice outlined; minor actions are links; delete and leave
  are red text, last, set apart. Phone: full width, own row, main first, never beside text. Desktop: label width,
  bottom-left, side by side; a narrow form card's submit button spans the card. 48 px tall, 40 px chips, labels
  never wrap. One selected-chip style (filled gold).
- **Loading.** Progress line while a screen loads; skeleton only after 150 ms; buttons show a spinner and a "…ing"
  label at the same width, and the form pauses; errors sit in the form next to what to fix. Reduced motion: no
  shimmer or sliding.
- **Wording.** British spelling, sentence case, one name per thing (`Create a free account`, `Sign in`,
  `2-step sign-in`, `Desk` with `My log` inside), every date as `01 Jan 2016` (owner, 28 Nov: one format to read; built by `formatDate` in `@astro/copy`, never by the browser, and picked with day, month and year dropdowns), 24-hour times, finished
  sentences, numbers that agree with their nouns.

## The work, in order (one PR each, merge only on "merge")

1. **Frame, navigation and loading.** A shared `AppFrame` (top bar, tabs, side menu, page header, card, button and
   chip styles) in `apps/web`; router links throughout; a progress line from the router's navigation state; the
   150 ms skeleton rule; the busy-button pattern in one component. The existing screens adopt it with no other
   change, so this PR shows the structure on its own.
2. **Screen fixes.** Every audit finding, screen by screen: Today (both states), Journal and Patterns (one empty
   message, label above each bar, equal cards, one chip style, note line only when written), Account, Reading
   (names fit the face, two lines at most), Verify badge, draw screens (one instruction line, left-aligned header),
   auth pages (framed card on desktop), not-found inside the frame.
3. **Wording.** The catalogue (`packages/copy`), the 37 email strings and the card-meaning composition in
   `packages/meanings` (no repeated sentence, shorter paragraphs, "Read more" for the rest). Through the existing
   wording catalogue, so the owner can still change any line in admin. The Terms and Privacy placeholder needs the
   owner's real text; that is not a code change.
4. **Reader pages.** Desk, My log (list, record, edit), invite, offer and reader guidelines rebuilt in `apps/web`
   in the new style, with their API in `astro-api` (same rules as today: reader role and 2-step sign-in required,
   each reader sees only their own log, invite and offer tokens checked server-side, owner and admins can't read
   logs). The date picker shows day-month order. Readers get a Desk tab on phones and keep Patterns through Journal.
5. **Retire the old Worker.** Migrations move to `astro-api`'s deploy command (`pnpm db:migrate` then deploy); the
   `LEGACY` binding and the forwarding code are removed; the WebSocket fallback for draw start is removed. The
   `apps/app` folder stays, because `apps/web` reuses its components; only its Worker stops deploying.

## Security

Nothing in the polish changes who can see what. For the reader pages: every route checks the session and role on
the server (the 5-minute pass is not enough for reader actions, which re-check the role and 2-step status in the
database, as now); log entries are filtered by the signed-in reader's id in the query, never by an id from the
request; invite and offer tokens are single-use and compared in constant time; no log content is logged, sent to
AI or exposed to staff. The migrator password moves to `astro-api` as a **build secret** and is never a runtime
variable.

## Testing

- Layout checks in the e2e suite at 360, 768 and 1280 px for every screen: no horizontal scroll, no element
  overlapping another, no button label wrapping, content left edge identical across desktop screens.
- Navigation: tapping a tab never shows a blank screen (the frame stays in the page); `/api/session` called once per
  visit.
- Wording: a test that fails on banned variants (`Sign up free`, `Create account`, US spellings in the catalogue,
  `0 of 1`-style plurals) and on a card meaning that repeats a sentence.
- Reader API: role, 2-step and ownership tests for every route, including another reader's entry id.
- The CPU script stays under budget on every route, old and new.

## Owner steps (browser only, after PR 5)

In Cloudflare → `astro-api` → Settings → Build: add the build secret `DATABASE_URL_MIGRATOR` and change the
deploy command to run migrations first. Then disconnect `astro-app`'s build. Exact clicks will be in
`docs/DEPLOYMENT.md` §19.

## Not in this stage

Paid AI and reader readings (Phase 4b), moving Astro's data out of the niko-knowledge Neon project, the admin
portal move (stage 3), the parked two-factor policy branch.
