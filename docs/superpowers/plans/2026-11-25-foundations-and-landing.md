# Foundations and Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Set up the Astro monorepo with CI, shared design tokens, the 78-card catalogue and the verifiable draw engine, and ship the animated landing page v2 as a static site on Cloudflare Workers.

**Architecture:**
- **Monorepo:** a Turborepo with pnpm workspaces. Shared code lives in `packages/*`, and each deployable surface in `apps/*`.
- **Landing page:** a Next.js App Router static export (`output: "export"`), served by a Cloudflare Worker as static assets, with security headers in `_headers`.
- **Motion and 3D:** loaded only on the client. Content is fully visible without JavaScript.

**Tech Stack:**
- Monorepo and tooling: pnpm 10, Turborepo 2, TypeScript 5 (strict).
- Landing app: Next.js 15, React 19, Tailwind CSS 4.
- Motion: GSAP 3 (ScrollTrigger, CustomEase, `@gsap/react`), Lenis 1.
- 3D: three.js (vanilla, dynamically imported).
- Testing: Vitest 3, Playwright (using the system Chrome).
- Deploy: Wrangler 4.

**Spec:** `docs/spec/2026-11-24-astro-design.md`. The full spec is the Claude Doc linked inside it.

## Global Constraints

- Node 22, pnpm 10. Every package is TypeScript with `"strict": true` and ESM (`"type": "module"`).
- Colours: Night #0B0B14, Ink #14142A, Nebula #2A2350, Gold #D8B46A, Moon #EDE6D6, Muted #8C88A6, Error #E26D6D, plus Daybreak Paper #F4EEE2, Daybreak Ink #1B1830, Gold-deep #7A5A1E.
- Fonts: Cormorant Garamond (500, 600, italic 500) for display, Inter (400, 500, 600) for UI. Both are self-hosted through `next/font`, with no request to Google at runtime.
- Easings:
  - `astroOut` = `cubic-bezier(0.23,1,0.32,1)`;
  - `astroInOut` = `cubic-bezier(0.77,0,0.175,1)`.
  - Never use ease-in on UI.
  - UI transitions stay at or under 300 ms.
- Only `transform` and `opacity` may be animated (plus `clip-path` if it's ever needed).
- Reduced motion keeps fades and removes movement. It disables Lenis, WebGL, parallax, the deck loop and tilt.
- **Content is visible with no JavaScript.** Animation start states are set from JS (`gsap.from` after mount). CSS never ships a hidden start state.
- Draw fingerprint: the first 16 lowercase hex characters of `SHA-256(order.join(",") + ":" + salt)`. The salt is 16 random bytes as lowercase hex. The display format is four groups of 4 separated by spaces.
- Domains and links:
  - The landing page serves `astro.midnightpoetry.studio`.
  - App CTA links point to `https://astroapp.midnightpoetry.studio/today`, `/sign-in` and `/deeper?tier=ai|human`.
- No secrets in the repo. `.env*` and `.dev.vars*` are git-ignored. CI reads `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` from GitHub secrets.
- Copy: no prices are hard-coded. Price labels read "Priced in the app" until plan 3 wires live prices.
- Disclaimer text, verbatim: "For reflection and entertainment. Not a substitute for medical, legal or financial advice."

## Review Focus

1. **Reduced motion:** with `prefers-reduced-motion: reduce`, there's no smooth-scroll takeover, no WebGL canvas and no looping deck, and every section is fully visible. Tested in Task 7.
2. **JavaScript off, or a script failing to load:** every heading, paragraph and link is visible and readable. Tested in Task 6 with JS disabled.
3. **No WebGL** (old devices, blocked GPU): the hero shows the static SVG sky with no error in the console. Tested in Task 8.
4. **A 360 px wide phone:** no horizontal scroll; the deck fan and pairs scale down. Tested in Task 6.
5. **Keyboard users:** a skip link reaches the main content; anchor links (#deck and the others) move focus and scroll correctly with Lenis active. Tested in Task 7.

---

### Task 1: Monorepo scaffold and CI

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.nvmrc` (`22`), `.editorconfig`, `.npmrc` (`engine-strict=true`)
- Create: `packages/config/package.json` (name `@astro/config`), `packages/config/tsconfig.base.json`, `packages/config/eslint.config.js`
- Create: `.github/workflows/ci.yml`, `.github/dependabot.yml`

**Interfaces:**
- Produces:
  - Root scripts `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (each calls `turbo run <task>`).
  - `@astro/config/tsconfig.base.json` (strict, `moduleResolution: "bundler"`, `target: "ES2022"`).
  - `@astro/config/eslint` (a flat config with typescript-eslint recommended).

- [ ] **Step 1:** Create the root files. The workspace globs are `apps/*` and `packages/*`. `turbo.json` defines the tasks `build` (outputs `out/**`, `dist/**`, `.next/**`), `lint`, `typecheck` and `test`. `test` depends on `^build`.
- [ ] **Step 2:** Write `ci.yml`, triggered on pull requests and pushes to `main`:
  - checkout, `pnpm/action-setup`, `actions/setup-node` (node 22, pnpm cache);
  - `pnpm install --frozen-lockfile`;
  - `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
  - Set `permissions: contents: read` and `concurrency` per ref.
- [ ] **Step 3:** In `dependabot.yml`, configure weekly updates for the npm ecosystem and GitHub Actions.
- [ ] **Step 4:** Run `pnpm install && pnpm lint && pnpm typecheck`. Expected: exit 0 (with no packages yet, turbo reports 0 tasks).
- [ ] **Step 5:** Commit `chore: monorepo scaffold and CI`.

### Task 2: Design tokens package

**Files:**
- Create: `packages/tokens/package.json` (`@astro/tokens`), `src/index.ts`, `src/tokens.css`, `src/contrast.ts`, `test/contrast.test.ts`

**Interfaces:**
- Produces:
  - `colors: { night, ink, nebula, gold, moon, muted, error, paper, inkDay, goldDeep }` as hex strings.
  - `ease: { out: "cubic-bezier(0.23,1,0.32,1)", inOut: "cubic-bezier(0.77,0,0.175,1)" }`.
  - `duration: { press: 140, hover: 200, ui: 240 }` in ms.
  - `contrastRatio(fg: string, bg: string): number`.
  - `tokens.css` exposes the same values as CSS variables (`--astro-night` and so on, `--ease-out`, `--ease-in-out`) for Tailwind's `@theme`.

- [ ] **Step 1: Write the failing test.** `contrast.test.ts` asserts:
  - `contrastRatio("#FFFFFF", "#000000")` is close to 21, and `contrastRatio(x, x) === 1`;
  - every body-text pair passes 4.5: moon on night, moon on ink, muted on night, gold on night, night on gold (button text), inkDay on paper, goldDeep on paper.
- [ ] **Step 2:** Run `pnpm --filter @astro/tokens test`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `contrastRatio` using the WCAG relative-luminance formula, then the token exports and `tokens.css`.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(tokens): design tokens with contrast checks`.

### Task 3: Card catalogue package

**Files:**
- Create: `packages/cards/package.json` (`@astro/cards`), `src/index.ts`, `src/majors.ts`, `src/minors.ts`, `test/cards.test.ts`

**Interfaces:**
- Produces:
  - `type Arcana = "major" | "minor"`
  - `type Suit = "wands" | "cups" | "swords" | "pentacles"`
  - `type Element = "fire" | "water" | "air" | "earth"`
  - `interface Card { id: string; name: string; arcana: Arcana; suit: Suit | null; number: number; numeral: string; element: Element; keywords: [string, string, string] }`
  - `allCards: readonly Card[]` (78), `majors` (22, numbered 0–21), `minors` (56)
  - `getCard(id: string): Card` (throws `UnknownCardError` for an unknown id)
- Rules:
  - Ids are kebab-case names: `the-fool`, `wheel-of-fortune`, `ace-of-cups`, `king-of-pentacles`.
  - Minor numbers run 1–14 (Ace=1, Page=11, Knight=12, Queen=13, King=14).
  - Suit elements: wands→fire, cups→water, swords→air, pentacles→earth.
  - Major elements, in order 0–21: air, air, water, earth, fire, earth, air, water, fire, earth, fire, air, water, water, fire, earth, fire, air, water, fire, fire, earth.
  - Majors use numerals "0" and "I"–"XXI"; minors use an empty string.
  - Keywords are three original words per card.

- [ ] **Step 1: Write the failing test.** Assert:
  - 78, 22 and 56 cards; all ids unique;
  - majors numbered 0..21 in order; each suit has 14 cards numbered 1..14;
  - `getCard("the-star")` has element `"air"`, numeral `"XVII"` and number 17;
  - `getCard("nope")` throws `UnknownCardError`;
  - every card has exactly three non-empty keywords.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement the data files and helpers.
- [ ] **Step 4:** Run it. Expected: PASS.
- [ ] **Step 5:** Commit `feat(cards): 78-card catalogue`.

### Task 4: Verifiable draw engine

**Files:**
- Create: `packages/draw/package.json` (`@astro/draw`), `src/random.ts`, `src/shuffle.ts`, `src/commitment.ts`, `src/pick.ts`, `src/index.ts`, `test/*.test.ts`

**Interfaces:**
- Consumes: nothing. It works on plain string ids, so it runs in Node 22 and in Workers through Web Crypto.
- Produces:
  - `secureRandomInt(maxExclusive: number): number` uses `crypto.getRandomValues` with rejection sampling. It throws `RangeError` unless `1 <= maxExclusive <= 2**32` and the value is an integer.
  - `type RandomInt = (maxExclusive: number) => number`
  - `shuffle<T>(items: readonly T[], rand: RandomInt = secureRandomInt): T[]` is a Fisher–Yates shuffle that returns a new array.
  - `assignOrientations(order: readonly string[], reversalRate: number, rand?: RandomInt): ("upright" | "reversed")[]`. The rate is 0..1; it throws `RangeError` otherwise. A card is reversed when `rand(10000) < Math.round(rate * 10000)`.
  - `createSalt(): string` returns 32 lowercase hex characters.
  - `fingerprintOf(order: readonly string[], salt: string): Promise<string>` returns 16 lowercase hex characters.
  - `formatFingerprint(fp: string): string`, for example `"a3f9 0c7e 51bd 92e4"`.
  - `createCommitment(order: readonly string[]): Promise<{ order: string[]; salt: string; fingerprint: string }>`
  - `verifyCommitment(order: readonly string[], salt: string, fingerprint: string): Promise<boolean>`
  - `pickAt(order: readonly string[], position: number, taken: readonly number[]): string` throws `PickError` if the position is out of range, not an integer, or already taken.

- [ ] **Step 1: Write the failing tests.**
  - `secureRandomInt`:
    - `secureRandomInt(1) === 0`;
    - `RangeError` for 0, -1, 1.5 and `2**32 + 1`;
    - 10,000 calls of `secureRandomInt(6)` all fall in 0..5, and each value appears more than 1,400 times.
  - `shuffle`:
    - the output is a permutation of the input and the input is not mutated;
    - with a scripted `rand` returning `[0,0,0,...]`, `shuffle(["a","b","c"])` equals `["b","c","a"]` (Fisher–Yates from the end with j=0);
    - over 22,000 shuffles of 22 ids, the count of `"the-fool"` at position 0 falls between 800 and 1,200.
  - Fingerprint:
    - `fingerprintOf(["a","b"], "00")` equals `createHash("sha256").update("a,b:00").digest("hex").slice(0,16)`, computed in the test with `node:crypto`;
    - `verifyCommitment` is true on the round trip, and false if one card is swapped, the salt changes, or the fingerprint changes.
  - `pickAt` throws on positions -1, 22, 2.5, and a taken position.
  - `assignOrientations` returns all "upright" at rate 0, all "reversed" at rate 1, and throws at 1.5.
- [ ] **Step 2:** Run `pnpm --filter @astro/draw test`. Expected: FAIL.
- [ ] **Step 3:** Implement. Use `crypto.subtle.digest("SHA-256", …)` for the fingerprint.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(draw): secure shuffle with verifiable fingerprint`.

### Task 5: Landing app shell, fonts, security headers

**Files:**
- Create: `apps/landing/package.json` (`@astro/landing`), `next.config.ts` (`output: "export"`, `images.unoptimized: true`, `poweredByHeader: false`), `tsconfig.json`, `postcss.config.mjs`, `app/globals.css` (Tailwind 4, `@import "@astro/tokens/tokens.css"`), `app/layout.tsx`, `app/page.tsx`, `app/fonts.ts`
- Create: `apps/landing/public/_headers`, `apps/landing/scripts/csp.mjs`, `apps/landing/wrangler.jsonc`
- Create: `apps/landing/playwright.config.ts`, `apps/landing/e2e/shell.spec.ts`

**Interfaces:**
- Produces:
  - `RootLayout` with a skip link (`<a href="#main">Skip to content</a>`), `<main id="main">`, `lang="en"`, and the font CSS variables `--font-display` and `--font-ui`.
  - Metadata: title "Astro — Daily tarot, read slowly", a description, and the Open Graph basics.
  - The `pnpm --filter @astro/landing build` output goes to `apps/landing/out/`.
- Headers:
  - `_headers` sets on `/*`:
    - `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`
    - `X-Content-Type-Options: nosniff`
    - `Referrer-Policy: strict-origin-when-cross-origin`
    - `Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()`
    - `Cross-Origin-Opener-Policy: same-origin`
    - a `Content-Security-Policy` placeholder line.
  - After `next build`, `scripts/csp.mjs` reads every inline `<script>` in `out/**/*.html`, computes `sha256-` hashes, and replaces the placeholder. The final CSP is: `default-src 'self'; script-src 'self' <hashes>; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'; upgrade-insecure-requests`.
- Wrangler: `wrangler.jsonc` with `name: "astro-landing"`, `assets: { directory: "./out", not_found_handling: "404-page" }`, and the route `astro.midnightpoetry.studio/*` as a custom domain. Plan 4 adds the more specific `/admin*` route on the admin Worker.

- [ ] **Step 1: Write the failing e2e test.** `shell.spec.ts`, using Playwright with `channel: "chrome"` and `webServer` running `npx serve out -l 4310`:
  - the page title contains "Astro";
  - the skip link is the first focusable element and moves focus to `#main`;
  - `<html lang="en">`;
  - there are no console errors.
- [ ] **Step 2:** Run `pnpm --filter @astro/landing build && pnpm --filter @astro/landing e2e`. Expected: FAIL.
- [ ] **Step 3:** Implement the shell, fonts, `_headers` and `csp.mjs`. Chain the build script: `next build && node scripts/csp.mjs`.
- [ ] **Step 4:** Add a Vitest unit test, `scripts/csp.test.mjs`. Given an HTML string with one inline script `alert(1)`, the hash equals `sha256-` plus the base64 SHA-256 of `alert(1)`, and the placeholder is gone from the rewritten headers. Run it, then run e2e. Expected: PASS.
- [ ] **Step 5:** Commit `feat(landing): app shell, self-hosted fonts, security headers`.

### Task 6: Landing chapters (static content, responsive)

**Files:**
- Create: `apps/landing/content/site.ts`, plus these components in `apps/landing/components/`:
  - `Header.tsx`, `Footer.tsx`, `Hero.tsx`, `StaticSky.tsx`
  - `DeckChapter.tsx`, `PairsChapter.tsx`, `ThreadChapter.tsx`, `PromiseChapter.tsx`, `DeeperChapter.tsx`, `FinalCta.tsx`
  - `ChapterRail.tsx`, `CardBack.tsx`, `CardFace.tsx`
- Modify: `apps/landing/app/page.tsx`
- Test: `apps/landing/e2e/content.spec.ts`

**Interfaces:**
- Consumes: `getCard` from `@astro/cards` (The Tower, Strength, The Sun; Five of Pentacles, Three of Cups, Page of Wands; The Star) and `colors` from `@astro/tokens`.
- Produces:
  - Section ids `top`, `deck`, `pairs`, `thread`, `promise`, `deeper`; each is a `<section aria-labelledby>`.
  - `data-anim` attributes that Task 7 targets: `hero-card`, `hero-line`, `hero-intro`, `deck`, `deck-card`, `deck-chosen`, `deck-flipper`, `deck-glow`, `deck-step`, `pair-major`, `pair-minor`, `suit-bar`, `reveal`, `hero-out`, `progress`.
  - `content/site.ts` holds all copy, including the CTA URLs and the verbatim disclaimer.
- Copy and layout follow the Landing v2 mockup (canvas artboard `Landing-Journey.dc.html`). Price lines read "Priced in the app".

- [ ] **Step 1: Write the failing e2e test.** In `content.spec.ts`:
  - At 1440×900: h1 text is "Every day, one card turns."; six chapter sections exist; the primary CTA href is `https://astroapp.midnightpoetry.studio/today`; the four promise titles are present; the disclaimer text matches verbatim.
  - At 360×780: `document.documentElement.scrollWidth <= 360`.
  - With `javaScriptEnabled: false`: every `[data-anim="reveal"]` element has a computed opacity of 1, and the h1 is visible.
- [ ] **Step 2:** Run e2e. Expected: FAIL.
- [ ] **Step 3:** Implement the components as Server Components (no `"use client"`), styled with Tailwind using the tokens. `StaticSky` renders a deterministic SVG starfield of 180 points using an LCG with seed 23.
- [ ] **Step 4:** Run e2e. Expected: PASS.
- [ ] **Step 5:** Commit `feat(landing): six-chapter scroll journey content`.

### Task 7: Motion layer (GSAP, ScrollTrigger, Lenis)

**Files:**
- Create: `apps/landing/components/motion/MotionProvider.tsx` (`"use client"`), `useReducedMotion.ts`, `timelines/hero.ts`, `timelines/reveals.ts`, `timelines/deck.ts`, `timelines/pairs.ts`, `timelines/thread.ts`, `ease.ts`
- Modify: `apps/landing/app/page.tsx` (wrap the content in `MotionProvider`)
- Test: `apps/landing/e2e/motion.spec.ts`, `apps/landing/components/motion/timelines/deck.test.ts`

**Interfaces:**
- Consumes: the `data-anim` hooks from Task 6, and `ease` from `@astro/tokens`.
- Produces:
  - `registerEases()` creates CustomEase `astroOut` (`"0.23,1,0.32,1"`) and `astroInOut` (`"0.77,0,0.175,1"`).
  - `buildDeckLoop(root: HTMLElement): gsap.core.Timeline`: a 9 s repeating timeline. Phase boundaries as fractions of 9 s:
    - riffle out 0–0.07, merge 0.07–0.13;
    - riffle reverse 0.13–0.19, merge 0.19–0.25;
    - fan 0.25–0.38;
    - lift the chosen card 0.38–0.48;
    - flip 0.50–0.60;
    - hold to 0.78, flip back 0.78–0.86;
    - drop 0.82–0.88, gather 0.86–0.96.
    - Caption steps are active during 0–0.32, 0.38–0.48 and 0.54–0.86.
    - Riffle offsets are ±(54 + (index % 5) × 6) px, alternating sign. Fan angles are −31.5° + index × 3° around a transform origin 900 px below. Fan-out is staggered 14 ms per index.
  - Lenis: `new Lenis({ lerp: 0.1 })`, driven by `gsap.ticker`, with `lenis.on("scroll", ScrollTrigger.update)` and `gsap.ticker.lagSmoothing(0)`. Anchor clicks go through `lenis.scrollTo(target, { offset: 0 })` and then move focus to the target section.
  - Scroll behaviour:
    - Reveals: `gsap.from(el, { y: 28, opacity: 0, ease: "astroOut", duration: 0.9 })` with `ScrollTrigger start: "top 85%"`, `once: true`, and a 60 ms stagger inside a group.
    - Hero out: scrubbed over 0–640 px.
    - Progress bar: `scaleX` scrubbed across the page.
    - Pairs: majors flip in from `rotationY: 85` with a 150 ms stagger, then minors tuck in from `x: -30, y: 40, rotation: -8`.
    - Suit bars grow with `scaleX` from 0, with the transform origin at the left.
  - The deck loop plays only while `#deck` is in view (`ScrollTrigger onToggle`).
  - With reduced motion: no Lenis, no deck loop, no scrubs; reveals use opacity only, over 0.4 s.
  - Everything is created inside `useGSAP` with `scope` and reverted on unmount.

- [ ] **Step 1: Write the failing tests.**
  - `deck.test.ts` (Vitest with jsdom): with 21 cards and 1 chosen card, `buildDeckLoop` returns a timeline with `duration()` equal to 9 and `repeat()` equal to -1. The chosen card's tween to `rotationY: 180` starts at 4.5 s (0.50 × 9).
  - `motion.spec.ts`:
    - default: after load, `html` has the class `lenis` and `[data-anim="deck-card"]` transforms change between two samples 500 ms apart while `#deck` is in view;
    - with `reducedMotion: "reduce"`: there's no `lenis` class, deck transforms stay equal across the two samples, and every reveal has opacity 1 after scrolling to the bottom;
    - keyboard: Tab to the "Begin the journey" link, press Enter, and `#deck` becomes the focused element.
- [ ] **Step 2:** Run the tests. Expected: FAIL.
- [ ] **Step 3:** Implement the provider and timelines.
- [ ] **Step 4:** Run the tests. Expected: PASS.
- [ ] **Step 5:** Commit `feat(landing): GSAP and Lenis motion layer with reduced-motion support`.

### Task 8: three.js starfield hero

**Files:**
- Create: `apps/landing/components/three/Starfield.tsx` (`"use client"`, loaded with `next/dynamic`, `ssr: false`), `three/createStarfield.ts`, `three/canUseWebGL.ts`
- Modify: `apps/landing/components/Hero.tsx` (render `Starfield` over `StaticSky`; `StaticSky` stays as the fallback and LCP layer)
- Test: `apps/landing/e2e/starfield.spec.ts`

**Interfaces:**
- Produces:
  - `createStarfield(canvas: HTMLCanvasElement, opts: { count: number; reducedMotion: boolean }): { start(): void; stop(): void; resize(): void; dispose(): void }`.
  - `canUseWebGL(): boolean`.
  - Settings: 1,200 points (700 when `innerWidth < 768`), `devicePixelRatio` capped at 1.5, rotation 0.02 rad/s, pointer parallax up to ±0.05 rad (only when hover and fine-pointer media match).
  - It stops when the hero leaves view (IntersectionObserver) or the tab is hidden, and disposes geometry, material and renderer on unmount.
  - With no WebGL or with reduced motion, no canvas is mounted.

- [ ] **Step 1: Write the failing e2e test.**
  - Default: a `canvas[data-starfield]` exists inside `#top` and there are no console errors.
  - Launching Chrome with `--disable-gpu --disable-webgl`: no canvas, the static SVG sky is visible, and there are no console errors.
  - With reduced motion: no canvas.
- [ ] **Step 2:** Run it. Expected: FAIL.
- [ ] **Step 3:** Implement it, using the `three` imports `WebGLRenderer`, `Scene`, `PerspectiveCamera`, `BufferGeometry`, `Float32BufferAttribute`, `PointsMaterial` and `Points` only, for tree-shaking.
- [ ] **Step 4:** Run it. Expected: PASS. Also check that `out/_next/static/chunks` for the first load stays under 200 KB gzipped, excluding the lazily loaded three chunk. Record the numbers in the PR description.
- [ ] **Step 5:** Commit `feat(landing): three.js starfield with WebGL and motion fallbacks`.

### Task 9: Cloudflare deploy for the landing page

> **Superseded (2026-11-25):** the owner moved deploys and migrations to Cloudflare Workers Builds. `deploy-landing.yml` was removed; see `docs/DEPLOYMENT.md`.

**Files:**
- Create: `.github/workflows/deploy-landing.yml`, `docs/deploy.md`
- Modify: `apps/landing/package.json` (add the scripts `deploy: "wrangler deploy"` and `preview: "wrangler dev"`)

**Interfaces:**
- Consumes: the GitHub secrets `CLOUDFLARE_API_TOKEN` (scoped to Workers Scripts: Edit and Workers Routes: Edit for this zone) and `CLOUDFLARE_ACCOUNT_ID`.
- Produces: on push to `main` with changes under `apps/landing/**` or `packages/**`, the workflow builds and runs `pnpm --filter @astro/landing deploy`. It uses the GitHub environment `production`, which requires approval.

- [ ] **Step 1:** Write the workflow with `permissions: contents: read`, a pinned major version of `cloudflare/wrangler-action`, and `workingDirectory: apps/landing`.
- [ ] **Step 2:** In `docs/deploy.md`, document:
  - the one-time setup: create the API token, add the secrets, attach the custom domain;
  - how to verify the headers with `curl -sI https://astro.midnightpoetry.studio`.
- [ ] **Step 3:** Run `npx wrangler deploy --dry-run --outdir /tmp/wr` inside `apps/landing`. Expected: exit 0, and the assets directory lists `index.html`.
- [ ] **Step 4:** Commit `ci: deploy landing page to Cloudflare Workers`.
