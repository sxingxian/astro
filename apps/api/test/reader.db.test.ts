import { neonWsOverPostgres, resetAndMigrate } from "@astro/db/testing";
import { createWsDb } from "@astro/db/ws";
import { newInviteToken } from "@astro/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/index";
import { admin, closeAll, dbUrl, env, execution, freshIp, http, person, webUrl } from "./helpers";

/** The pass cookie the browser ends up with: the last one a response sets wins. */
const finalPass = (res: Response) => res.headers.getSetCookie().filter((c) => c.startsWith("astro.pass=")).at(-1)?.split(";")[0]?.slice("astro.pass=".length);

// Stage 2: the reader pages' API (Desk, My log, guidelines, giving up the role, invitations and role offers) on the
// data Worker, over the HTTPS client, with the WebSocket client only where a grant and its audit entry must commit
// together.

let proxy: Awaited<ReturnType<typeof neonWsOverPostgres>>;
const app = createApp({ db: () => http, txDb: () => createWsDb(webUrl, { wsProxy: proxy.address }) });
const run = execution();
const call = async (method: string, path: string, cookie?: string, body?: unknown, headers: Record<string, string> = {}) => {
  const res = await app.request(
    path,
    { method, headers: { origin: env.APP_URL, "content-type": "application/json", "cf-connecting-ip": freshIp(), ...(cookie ? { cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) },
    env,
    run.ctx
  );
  await run.settle();
  return res;
};
const get = (path: string, cookie?: string) => call("GET", path, cookie);

const entry = (over: Record<string, unknown> = {}) => ({
  readOn: "2026-11-20",
  place: "in_person",
  name: "Jun",
  question: "Work?",
  notes: "=SUM(A1)",
  consent: true,
  spread: "one",
  cards: { positions: [{ label: "Card", card: { id: "the-star", reversed: false } }], extras: [] },
  ...over
});

let ownerId = "";
beforeAll(async () => {
  await resetAndMigrate(dbUrl);
  proxy = await neonWsOverPostgres();
  const o = await person();
  ownerId = o.uid;
  await admin`insert into staff_role (user_id, role) values (${ownerId}, 'owner')`;
});
afterAll(async () => {
  await proxy.close();
  await closeAll();
});

const twoStepOn = (uid: string) => admin`update "user" set two_factor_enabled = true where id = ${uid}`;
const publishGuidelines = async () => {
  const [v] = await admin<{ id: string }[]>`insert into text_version (kind, snapshot) values ('guidelines', ${admin.json({ "legal.guidelines": JSON.stringify({ v: 1, blocks: [{ t: "p", c: [{ t: "text", text: "Be kind." }] }] }) })}) returning id`;
  return Number(v!.id);
};

describe("Desk", () => {
  it("is for readers only: signed out 401, everyone else 404", async () => {
    expect((await get("/api/desk")).status).toBe(401);
    expect((await get("/api/desk", (await person()).cookie)).status).toBe(404);
  });

  it("asks a reader to agree to newly published guidelines first, and shows them", async () => {
    const r = await person({ reader: true });
    const version = await publishGuidelines();
    const before = (await (await get("/api/desk", r.cookie)).json()) as { accepted: boolean; guidelines: { version: number; doc: unknown } | null };
    expect(before.accepted).toBe(false);
    expect(before.guidelines?.version).toBe(version);
    expect(JSON.stringify(before.guidelines?.doc)).toContain("Be kind.");

    expect((await call("POST", "/api/reader/guidelines", r.cookie, { version: version - 1 })).status).toBe(409);
    expect((await call("POST", "/api/reader/guidelines", r.cookie, { version })).status).toBe(200);
    const after = (await (await get("/api/desk", r.cookie)).json()) as { accepted: boolean; guidelines: unknown };
    expect(after).toMatchObject({ accepted: true, guidelines: null });
  });
});

describe("My log", () => {
  it("records, lists, opens, edits and deletes a reader's own entries", async () => {
    const r = await person({ reader: true });
    const created = await call("POST", "/api/reader/log", r.cookie, entry());
    expect(created.status).toBe(200);
    const { id } = (await created.json()) as { id: string };

    const list = (await (await get("/api/reader/log", r.cookie)).json()) as { items: { id: string; name: string }[]; nextCursor: string | null; today: string };
    expect(list.items.map((e) => e.id)).toEqual([id]);
    expect(list.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const opened = (await (await get(`/api/reader/log/${id}`, r.cookie)).json()) as { name: string; cards: { positions: { card: { id: string } }[] } };
    expect(opened.name).toBe("Jun");
    expect(opened.cards.positions[0]?.card.id).toBe("the-star"); // jsonb arrives as text over HTTPS

    expect((await call("PUT", `/api/reader/log/${id}`, r.cookie, entry({ name: "Aisha" }))).status).toBe(200);
    expect(((await (await get(`/api/reader/log/${id}`, r.cookie)).json()) as { name: string }).name).toBe("Aisha");
    expect((await call("DELETE", `/api/reader/log/${id}`, r.cookie, {})).status).toBe(200);
    expect((await get(`/api/reader/log/${id}`, r.cookie)).status).toBe(404);
  });

  it("never shows or changes another reader's entry, and refuses non-readers and other sites", async () => {
    const a = await person({ reader: true });
    const b = await person({ reader: true });
    const { id } = (await (await call("POST", "/api/reader/log", a.cookie, entry())).json()) as { id: string };
    expect((await get(`/api/reader/log/${id}`, b.cookie)).status).toBe(404);
    expect((await call("PUT", `/api/reader/log/${id}`, b.cookie, entry())).status).toBe(404);
    expect((await call("DELETE", `/api/reader/log/${id}`, b.cookie, {})).status).toBe(404);
    expect(((await (await get("/api/reader/log", b.cookie)).json()) as { items: unknown[] }).items).toEqual([]);

    const plain = await person();
    expect((await get("/api/reader/log", plain.cookie)).status).toBe(403);
    expect((await call("POST", "/api/reader/log", plain.cookie, entry())).status).toBe(403);
    expect((await call("POST", "/api/reader/log", a.cookie, entry(), { origin: "https://evil.example" })).status).toBe(403);
    expect((await call("POST", "/api/reader/log", a.cookie, entry({ consent: false }))).status).toBe(400);
  });

  it("downloads the log as CSV with formulas made harmless, and notes only the row count in the audit log", async () => {
    const r = await person({ reader: true });
    await call("POST", "/api/reader/log", r.cookie, entry());
    const res = await get("/api/reader/log/export", r.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(await res.text()).toContain(`"'=SUM(A1)"`);
    const [row] = await admin<{ keys: string; rows: string }[]>`select (select string_agg(k, ',') from jsonb_object_keys(summary) k) as keys, summary->>'rows' as rows from audit_log where actor_id = ${r.uid} and action = 'reader.log_export'`;
    expect(row).toEqual({ keys: "rows", rows: "1" }); // nothing from the log itself
  });
});

describe("giving up the reader role", () => {
  it("locks the log, records it in the audit log and clears the pass", async () => {
    const r = await person({ reader: true });
    const res = await call("POST", "/api/reader/give-up", r.cookie, {});
    expect(res.status).toBe(200);
    expect(finalPass(res)).toBe("");
    const [role] = await admin<{ revoked_at: Date | null }[]>`select revoked_at from reader_role where user_id = ${r.uid}`;
    expect(role?.revoked_at).not.toBeNull();
    expect((await admin`select 1 from audit_log where actor_id = ${r.uid} and action = 'reader.remove'`).length).toBe(1);
    expect((await call("POST", "/api/reader/give-up", r.cookie, {})).status).toBe(403);
  });
});

describe("role offers", () => {
  it("shows the offer only to its account, and accepting grants the role with an audit entry", async () => {
    expect(await (await get("/api/offer")).json()).toEqual({ state: "signed_out" });
    const p = await person();
    expect(await (await get("/api/offer", p.cookie)).json()).toMatchObject({ state: "none" });

    const [o] = await admin<{ id: string }[]>`insert into role_offer (user_id, reader, offered_by, expires_at) values (${p.uid}, true, ${ownerId}, now() + interval '72 hours') returning id`;
    const shown = (await (await get("/api/offer", p.cookie)).json()) as { state: string; offer: { id: string; reader: boolean; portalRole: null }; twoFactor: boolean; guidelines: { version: number } | null };
    expect(shown).toMatchObject({ state: "offer", offer: { id: o!.id, reader: true, portalRole: null }, twoFactor: false });
    expect(shown.guidelines).not.toBeNull();

    expect(((await (await call("POST", "/api/offer/accept", p.cookie, { offerId: o!.id, guidelines: shown.guidelines!.version })).json()) as { error: string }).error).toBe("two_step_required");
    await twoStepOn(p.uid);
    expect((await call("POST", "/api/offer/accept", p.cookie, { offerId: o!.id, guidelines: shown.guidelines!.version + 1 })).status).toBe(409);
    const ok = await call("POST", "/api/offer/accept", p.cookie, { offerId: o!.id, guidelines: shown.guidelines!.version });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ portal: null, reader: true });
    expect(finalPass(ok)).toBe("");
    expect((await admin`select 1 from reader_role where user_id = ${p.uid} and revoked_at is null`).length).toBe(1);
    expect((await admin`select 1 from audit_log where actor_id = ${p.uid} and action = 'reader.accept'`).length).toBe(1);
  });
});

describe("invitations", () => {
  it("tells the page who is signed in, and accepts a matching invite once, with an audit entry", async () => {
    expect(await (await get("/api/invite")).json()).toMatchObject({ signedIn: false });
    const p = await person();
    const [u] = await admin<{ email: string }[]>`select email from "user" where id = ${p.uid}`;
    const { token, hash } = await newInviteToken();
    await admin`insert into invite (email, role, token_hash, invited_by, expires_at) values (${u!.email}, 'reader', ${hash}, ${ownerId}, now() + interval '72 hours')`;

    expect(await (await get("/api/invite", p.cookie)).json()).toMatchObject({ signedIn: true, email: u!.email, twoFactor: false, guidelines: null });
    await twoStepOn(p.uid);
    const shown = (await (await get("/api/invite", p.cookie)).json()) as { guidelines: { version: number } };

    // A reader invite sent without the guidelines version answers guidelines_changed and writes nothing.
    expect(((await (await call("POST", "/api/invite/accept", p.cookie, { token })).json()) as { error: string }).error).toBe("guidelines_changed");
    const ok = await call("POST", "/api/invite/accept", p.cookie, { token, guidelines: shown.guidelines.version });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ role: "reader" });
    expect((await admin`select 1 from audit_log where actor_id = ${p.uid} and action = 'team.accept'`).length).toBe(1);
    expect((await call("POST", "/api/invite/accept", p.cookie, { token, guidelines: shown.guidelines.version })).status).toBe(410);
    expect((await call("POST", "/api/invite/accept", p.cookie, { token: "short" })).status).toBe(400);
  });
});

describe("reader guidelines page", () => {
  it("is public, so invitees can read it before accepting", async () => {
    const res = await get("/api/legal/guidelines");
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty("doc");
  });
});
