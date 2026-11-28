import { expect, type Page } from "@playwright/test";
import { pickCard, signUpVerified, sql, test, uniqueEmail } from "./helpers";

// Stage 2 layout rules, checked on every main screen at phone, tablet and desktop widths: nothing scrolls sideways,
// no button label wraps, and no button sits on top of text.

test.setTimeout(240_000);

async function problems(page: Page, width: number): Promise<string[]> {
  return page.evaluate((w) => {
    const out: string[] = [];
    if (document.documentElement.scrollWidth > w) out.push(`scrolls sideways (${document.documentElement.scrollWidth}px)`);
    const main = document.getElementById("main");
    if (!main) return [...out, "no main"];
    const shown = (el: Element) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== "hidden";
    };
    const buttons = [...main.querySelectorAll(".btn-gold, .btn-ghost")].filter(shown);
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      if (r.height > 60) out.push(`button wraps: "${b.textContent?.trim()}" (${Math.round(r.height)}px)`);
    }
    const texts = [...main.querySelectorAll("p, h1, h2, h3, li > span, label")].filter((el) => shown(el) && !buttons.some((b) => b.contains(el) || el.contains(b)));
    for (const b of buttons) {
      const r = b.getBoundingClientRect();
      for (const el of texts) {
        const q = el.getBoundingClientRect();
        const x = Math.min(r.right, q.right) - Math.max(r.left, q.left);
        const y = Math.min(r.bottom, q.bottom) - Math.max(r.top, q.top);
        if (x > 2 && y > 2) out.push(`button "${b.textContent?.trim()}" covers "${el.textContent?.trim().slice(0, 40)}"`);
      }
    }
    // Text squeezed to one word per line (the old Today cards on a small phone, "Three / pairs" on desktop).
    for (const el of main.querySelectorAll("p, h1, h2, h3")) {
      if (!shown(el)) continue;
      const words = (el.textContent ?? "").trim().split(/\s+/).filter(Boolean).length;
      const lh = parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.2;
      const lines = Math.round(el.getBoundingClientRect().height / lh);
      if (words >= 2 && lines >= words) out.push(`text squeezed to a word per line: "${el.textContent?.trim().slice(0, 40)}"`);
    }
    return out;
  }, width);
}

test("member and guest screens follow the layout rules at 360, 768 and 1280 px", async ({ page, browser }) => {
  const email = uniqueEmail("layout");
  await signUpVerified(page, email);
  await page.goto("/draw/one");
  await pickCard(page, 20, 78);
  await page.getByRole("button", { name: "Turn the card" }).click();
  await page.waitForURL(/\/reading\//);
  const reading = new URL(page.url()).pathname;
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  const at = new Date(Date.now() - 8 * 86_400_000);
  const [s] = await sql<{ id: string }[]>`insert into draw_session (user_id, spread, local_day, time_zone, status, created_at, completed_at)
    values (${u!.id}, 'one', ${at.toISOString().slice(0, 10)}, 'UTC', 'complete', ${at}, ${at}) returning id`;
  await sql`insert into draw_deck (session_id, stage, "order", orientations, salt, fingerprint, picks)
    values (${s!.id}, 'single', ${["the-hierophant"]}::text[], ${["upright"]}::text[], '00', ${"0".repeat(32)}, ${[0]}::int[])`;

  const guest = await (await browser.newContext()).newPage();
  const screens: [Page, string][] = [
    ...["/today", "/journal", "/journal/patterns", "/account", reading, `${reading}/verify`, `/check-in/${s!.id}`, "/ask"].map((p) => [page, p] as [Page, string]),
    ...["/today", "/ask", "/sign-in", "/sign-up", "/draw/one", "/privacy"] /* not /terms: legal.spec needs it unread */.map((p) => [guest, p] as [Page, string])
  ];
  const found: string[] = [];
  for (const width of [360, 768, 1280]) {
    for (const [pg, path] of screens) {
      await pg.setViewportSize({ width, height: 800 });
      await pg.goto(path);
      await pg.waitForLoadState("networkidle");
      await expect(pg.locator("main [aria-busy]")).toHaveCount(0);
      for (const p of await problems(pg, width)) found.push(`${path} at ${width}: ${p}`);
    }
  }
  expect(found).toEqual([]);
});

test("reader screens follow the layout rules at 360, 768 and 1280 px", async ({ page, baseURL }) => {
  const email = uniqueEmail("layout-reader");
  await signUpVerified(page, email);
  const [u] = await sql<{ id: string }[]>`select id from "user" where email = ${email}`;
  await sql`insert into reader_role (user_id, granted_by) values (${u!.id}, ${u!.id})`;
  await sql`insert into guideline_acceptance (user_id, version) select ${u!.id}, coalesce(max(id), 0) from text_version where kind = 'guidelines'`;
  const saved = await page.request.post("/api/reader/log", {
    headers: { origin: baseURL ?? "" },
    data: { readOn: "2026-11-20", place: "online", name: "Hannah", question: "", notes: "", consent: true, spread: "three_pairs", cards: { positions: [["Past", "the-fool", "two-of-cups"], ["Present", "the-hermit", "page-of-swords"], ["Future", "the-star", "ten-of-cups"]].map(([label, card, clar]) => ({ label, card: { id: card, reversed: false }, clarifier: { id: clar, reversed: true } })), extras: [] } }
  });
  expect(saved.ok()).toBe(true);
  const { id } = (await saved.json()) as { id: string };

  const found: string[] = [];
  for (const width of [360, 768, 1280]) {
    for (const path of ["/desk", "/desk/log", "/desk/log/new", `/desk/log/${id}`, "/offer", "/invite", "/reader-guidelines"]) {
      await page.setViewportSize({ width, height: 800 });
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await expect(page.locator("main [aria-busy]")).toHaveCount(0);
      for (const p of await problems(page, width)) found.push(`${path} at ${width}: ${p}`);
    }
  }
  expect(found).toEqual([]);
});
