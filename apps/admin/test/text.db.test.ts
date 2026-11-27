import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createPreview, emailT, publish, rebuildAgain, restore, saveDraft, useDefault, type PublishDeps } from "@/lib/text";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const owner = { id: "o1", role: "owner" as const };
const admin = { id: "a1", role: "admin" as const };
const moderator = { id: "m1", role: "moderator" as const };
const HOOK = "https://api.cloudflare.com/client/v4/workers/builds/deploy_hooks/secret-hook-token";

let calls: string[] = [];
let logged: unknown[] = [];
let clock = new Date("2026-11-27T03:00:00Z");
const deps = (over: Partial<PublishDeps> = {}): PublishDeps => ({
  fetch: async (input) => {
    calls.push(String(input));
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  },
  hookUrl: HOOK,
  now: clock,
  log: async (entry) => void logged.push(entry),
  ...over
});

async function person(id: string, role: string) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${`${id}@example.com`}, true, true)`;
  await db.$client`insert into staff_role (user_id, role) values (${id}, ${role})`;
}

beforeAll(async () => {
  await resetAndMigrate(url);
  await person("o1", "owner");
  await person("a1", "admin");
  await person("m1", "moderator");
});
beforeEach(() => {
  calls = [];
  logged = [];
});
afterAll(async () => {
  await db.$client.end();
});

describe("drafts", () => {
  it("saves a valid draft and refuses invalid ones, unknown keys and roles without access", async () => {
    await expect(saveDraft(db, admin, "landing.hero.note", "x".repeat(5000))).rejects.toThrow(/too_long/);
    await expect(saveDraft(db, admin, "app.patterns.checked_in", "You checked in.")).rejects.toThrow(/placeholders/);
    await expect(saveDraft(db, admin, "nope.key", "x")).rejects.toThrow(/unknown_key/);
    await expect(saveDraft(db, moderator, "app.today.title", "x")).rejects.toThrow(/forbidden/);
    await expect(saveDraft(db, admin, "the-star.upright.summary", "Hope.")).rejects.toThrow(/forbidden/);
    expect(await saveDraft(db, admin, "app.today.title", "Tonight")).toEqual({ kind: "app" });
    expect(await saveDraft(db, owner, "the-star.upright.summary", "Hope returns.")).toEqual({ kind: "meanings" });
    await expect(saveDraft(db, owner, "the-star.as_clarifier", "x")).rejects.toThrow(/unknown_key/); // Majors have no clarifier
    await useDefault(db, admin, "app.today.title");
    const [row] = await db.$client`select count(*)::int as n from text_override where key = 'app.today.title'`;
    expect(row?.n).toBe(0);
  });
});

describe("publish", () => {
  it("rebuilds the landing page once per publish, at most every 2 minutes, never exposing the hook URL", async () => {
    await saveDraft(db, admin, "landing.hero.note", "New note");
    const first = await publish(db, admin, "landing", "launch copy", deps());
    expect(first).toMatchObject({ kind: "landing", rebuild: { status: 200 } });
    expect(calls).toEqual([HOOK]);
    const [v] = await db.$client<{ snapshot: Record<string, string>; note: string }[]>`select snapshot, note from text_version where id = ${first.version}`;
    expect(v).toEqual({ snapshot: { "landing.hero.note": "New note" }, note: "launch copy" });

    clock = new Date(clock.getTime() + 60_000);
    await expect(publish(db, admin, "landing", "", deps())).rejects.toThrow(/too_soon/);
    expect(calls).toHaveLength(1);

    clock = new Date(clock.getTime() + 61_000);
    await publish(db, admin, "landing", "", deps());
    expect(calls).toHaveLength(2);

    const everything = JSON.stringify([first, logged]);
    expect(everything).not.toContain("secret-hook-token");
    expect(logged).toContainEqual(expect.objectContaining({ action: "text.rebuild", summary: { version: first.version, status: 200 } }));
  });

  it("publishes even if the rebuild call fails, and says so", async () => {
    clock = new Date(clock.getTime() + 10 * 60_000);
    const r = await publish(db, admin, "landing", "", deps({ fetch: async () => { throw new Error(`connect to ${HOOK} failed`); } }));
    expect(r.rebuild).toEqual({ status: 0 });
    expect(JSON.stringify([r, logged])).not.toContain("secret-hook-token");
  });

  it("app publishes don't call the hook; only the owner publishes meanings", async () => {
    await saveDraft(db, admin, "app.today.title", "Tonight");
    const r = await publish(db, admin, "app", "", deps());
    expect(r.rebuild).toBeNull();
    expect(calls).toHaveLength(0);
    await expect(publish(db, admin, "meanings", "", deps())).rejects.toThrow(/forbidden/);
    const m = await publish(db, owner, "meanings", "", deps());
    const [v] = await db.$client<{ snapshot: Record<string, string> }[]>`select snapshot from text_version where id = ${m.version}`;
    expect(v?.snapshot).toEqual({ "the-star.upright.summary": "Hope returns." });
  });

  it("an invalid override blocks the publish", async () => {
    await db.$client`insert into text_override (key, kind, value) values ('app.patterns.checked_in', 'app', 'No placeholders')`;
    await expect(publish(db, admin, "app", "", deps())).rejects.toThrow(/invalid_override/);
    await db.$client`delete from text_override where key = 'app.patterns.checked_in'`;
  });
});

describe("legal documents", () => {
  const legal = (text: string) => JSON.stringify({ v: 1, blocks: [{ t: "h2", c: [{ t: "text", text }] }] });
  it("saves only valid documents, publishes each page on its own, and previews them", async () => {
    await expect(saveDraft(db, admin, "legal.terms", "<b>x</b>")).rejects.toThrow(/doc_invalid/);
    expect(await saveDraft(db, admin, "legal.terms", legal("Our terms"))).toEqual({ kind: "terms" });
    await saveDraft(db, admin, "legal.privacy", legal("Our privacy"));
    const [before] = await db.$client<{ n: number }[]>`select count(*)::int as n from text_version where kind = 'app'`;
    const r = await publish(db, admin, "terms", "", deps());
    const [v] = await db.$client<{ snapshot: Record<string, string> }[]>`select snapshot from text_version where id = ${r.version}`;
    expect(Object.keys(v!.snapshot)).toEqual(["legal.terms"]);
    const [after] = await db.$client<{ n: number }[]>`select count(*)::int as n from text_version where kind = 'app'`;
    expect(after!.n).toBe(before!.n);
    const p = await createPreview(db, admin, "privacy", clock);
    const [pv] = await db.$client<{ snapshot: Record<string, string> }[]>`select snapshot from text_preview where id = ${p.id}`;
    expect(Object.keys(pv!.snapshot)).toEqual(["legal.privacy"]);
  });
});

describe("restore and preview", () => {
  it("restoring publishes the old snapshot as a new version", async () => {
    const [old] = await db.$client<{ id: number }[]>`select id from text_version where kind = 'app' order by id limit 1`;
    await saveDraft(db, admin, "app.today.title", "Changed again");
    const newer = await publish(db, admin, "app", "", deps());
    const r = await restore(db, admin, old!.id, deps());
    expect(r.version).toBe(newer.version + 1);
    const [a, b] = await db.$client<{ snapshot: unknown }[]>`select snapshot from text_version where id in (${old!.id}, ${r.version}) order by id`;
    expect(b?.snapshot).toEqual(a?.snapshot);
    await expect(restore(db, admin, (await db.$client<{ id: number }[]>`select id from text_version where kind = 'meanings' limit 1`)[0]!.id, deps())).rejects.toThrow(/forbidden/);
  });

  it("restoring also resets that kind's drafts, so the next publish doesn't bring back what was undone", async () => {
    const [old] = await db.$client<{ id: number; snapshot: Record<string, string> }[]>`select id, snapshot from text_version where kind = 'app' order by id limit 1`;
    await saveDraft(db, admin, "app.today.title", "A bad heading");
    await publish(db, admin, "app", "", deps());
    await restore(db, admin, old!.id, deps());
    const rows = await db.$client<{ key: string; value: string }[]>`select key, value from text_override where kind = 'app'`;
    expect(Object.fromEntries(rows.map((r) => [r.key, r.value]))).toEqual(old!.snapshot);
  });

  it("restoring refuses a version whose wording no longer fits the catalogue, and drops keys that left it", async () => {
    const [bad] = await db.$client<{ id: number }[]>`insert into text_version (kind, snapshot) values ('app', ${JSON.stringify({ "app.patterns.checked_in": "No placeholders" })}::jsonb) returning id`;
    await expect(restore(db, admin, bad!.id, deps())).rejects.toThrow(/invalid_override/);
    const [gone] = await db.$client<{ id: number }[]>`insert into text_version (kind, snapshot) values ('app', ${JSON.stringify({ "app.removed.key": "x", "app.today.title": "Kept" })}::jsonb) returning id`;
    const r = await restore(db, admin, gone!.id, deps());
    const [v] = await db.$client<{ snapshot: Record<string, string> }[]>`select snapshot from text_version where id = ${r.version}`;
    expect(v?.snapshot).toEqual({ "app.today.title": "Kept" });
  });

  it("the landing rebuild can be started again, within the same 2-minute limit, without exposing the hook", async () => {
    clock = new Date(clock.getTime() + 10 * 60_000);
    const r = await rebuildAgain(db, admin, deps());
    expect(r).toMatchObject({ rebuild: { status: 200 } });
    expect(calls).toEqual([HOOK]);
    expect(JSON.stringify([r, logged])).not.toContain("secret-hook-token");
    expect(logged).toContainEqual(expect.objectContaining({ action: "text.rebuild" }));
    await expect(rebuildAgain(db, admin, deps())).rejects.toThrow(/too_soon/);
    await expect(rebuildAgain(db, moderator, deps())).rejects.toThrow(/forbidden/);
    expect(calls).toHaveLength(1);
  });

  it("a preview holds the current drafts for 30 minutes under an unguessable id", async () => {
    await saveDraft(db, admin, "app.today.title", "Changed again");
    const { id, expiresAt } = await createPreview(db, admin, "app", clock);
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(expiresAt.getTime() - clock.getTime()).toBe(30 * 60_000);
    const [p] = await db.$client<{ snapshot: Record<string, string> }[]>`select snapshot from text_preview where id = ${id}`;
    expect(p?.snapshot["app.today.title"]).toBe("Changed again");
    await expect(createPreview(db, admin, "landing", clock)).rejects.toThrow(/no_preview/);
  });

  it("portal emails use the published wording", async () => {
    await saveDraft(db, admin, "email.invite.subject", "Join the Astro team");
    await publish(db, admin, "app", "", deps());
    expect((await emailT(db))("email.invite.subject")).toBe("Join the Astro team");
  });
});
