import { catalogue } from "@astro/copy";
import { getMeaning } from "@astro/meanings";
import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { liveSnapshot, loadCopy } from "@astro/app-core/copy";
import { applyOverrides } from "@astro/meanings";
import type { AnyDb } from "@astro/db";

/** The card meanings with the published overrides on top, as the app builds them from the session's snapshot. */
const loadMeanings = async (d: AnyDb, opts: { cache?: boolean }) => {
  const overrides = await liveSnapshot(d, "meanings", opts.cache ?? true);
  return (cardId: string) => applyOverrides(getMeaning(cardId), overrides);
};

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const fresh = { cache: false } as const;

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await db.$client.end();
});

describe("loadCopy", () => {
  it("falls back to the default wording when the database can't be read, instead of failing the page", async () => {
    const down = createDb("postgres://nobody:nothing@127.0.0.1:1/none");
    try {
      const t = await loadCopy(down, fresh);
      expect(t("app.today.title")).toBe(catalogue["app.today.title"].default);
      expect((await loadMeanings(down, fresh))("the-star").upright.summary).toBe(getMeaning("the-star").upright.summary);
      expect(await loadCopy(down, { previewId: "live-preview-id-000000", cache: false })).toBeTypeOf("function");
    } finally {
      await down.$client.end();
    }
  });

  it("uses the catalogue default when nothing is published", async () => {
    const t = await loadCopy(db, fresh);
    expect(t("app.today.title")).toBe(catalogue["app.today.title"].default);
  });

  it("uses the newest published app version, filling placeholders", async () => {
    await db.$client`insert into text_version (kind, snapshot) values ('app', ${JSON.stringify({ "app.today.title": "Old" })}::jsonb)`;
    await db.$client`insert into text_version (kind, snapshot) values ('app', ${JSON.stringify({ "app.today.title": "Tonight's card", "email.verify.subject": "Confirm, {name}" })}::jsonb)`;
    const t = await loadCopy(db, fresh);
    expect(t("app.today.title")).toBe("Tonight's card");
  });

  it("ignores published keys that aren't in the catalogue, and landing versions", async () => {
    await db.$client`insert into text_version (kind, snapshot) values ('landing', ${JSON.stringify({ "landing.hero.note": "x" })}::jsonb)`;
    const t = await loadCopy(db, fresh);
    expect(t("app.today.title")).toBe("Tonight's card");
  });

  it("shows a live preview, and ignores an expired one", async () => {
    await db.$client`insert into text_preview (id, kind, snapshot, expires_at) values ('live-preview-id-000000', 'app', ${JSON.stringify({ "app.today.title": "Preview title" })}::jsonb, now() + interval '30 minutes')`;
    await db.$client`insert into text_preview (id, kind, snapshot, expires_at) values ('old-preview-id-0000000', 'app', ${JSON.stringify({ "app.today.title": "Stale" })}::jsonb, now() - interval '1 minute')`;
    expect((await loadCopy(db, { ...fresh, previewId: "live-preview-id-000000" }))("app.today.title")).toBe("Preview title");
    expect((await loadCopy(db, { ...fresh, previewId: "old-preview-id-0000000" }))("app.today.title")).toBe("Tonight's card");
  });
});

describe("loadMeanings", () => {
  it("overlays published meaning overrides on the built-in meanings", async () => {
    const before = (await loadMeanings(db, fresh))("the-star");
    expect(before.upright.summary).toBe(getMeaning("the-star").upright.summary);
    await db.$client`insert into text_version (kind, snapshot) values ('meanings', ${JSON.stringify({ "the-star.upright.summary": "Hope returns, quietly.", "the-star.upright.body": "First.\n\nSecond." })}::jsonb)`;
    const star = (await loadMeanings(db, fresh))("the-star");
    expect(star.upright.summary).toBe("Hope returns, quietly.");
    expect(star.upright.body).toEqual(["First.", "Second."]);
    expect(star.reversed.summary).toBe(getMeaning("the-star").reversed.summary);
  });
});
