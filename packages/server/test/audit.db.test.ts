import { createDb, sql } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { audit, AuditSummaryError, listAudit, withAudit } from "../src/audit";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const SECRET = "test-secret-0123456789abcdef0123456789";

beforeAll(async () => {
  await resetAndMigrate(url);
  await db.$client`insert into "user" (id, name, email, email_verified) values ('o1', 'o', 'owner@example.com', true), ('a1', 'a', 'admin@example.com', true)`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("audit", () => {
  it("stores an entry with a short keyed hash of the IP, never the IP itself", async () => {
    await audit(db, { actorId: "o1", actorRole: "owner", action: "team.invite", entity: "invite", entityId: "i1", summary: { email: "r@example.com", role: "reader" }, ip: "203.0.113.9" }, SECRET);
    const [row] = await db.$client<{ ip_hash: string; summary: unknown }[]>`select ip_hash, summary from audit_log where entity_id = 'i1'`;
    expect(row?.ip_hash).toMatch(/^[0-9a-f]{16}$/);
    expect(row?.ip_hash).not.toContain("203");
    expect(row?.summary).toEqual({ email: "r@example.com", role: "reader" });
  });

  it("refuses summary keys that aren't on the action's allowlist, so keys and free text can't get in", async () => {
    await expect(audit(db, { actorId: "o1", actorRole: "owner", action: "team.invite", entity: "invite", summary: { email: "x@example.com", key: "sk-live-123" } as never }, SECRET)).rejects.toBeInstanceOf(AuditSummaryError);
    const [n] = await db.$client<{ n: number }[]>`select count(*)::int as n from audit_log where summary->>'key' is not null`;
    expect(n?.n).toBe(0);
  });

  it("shortens long values instead of refusing them, so a long input can't skip the log", async () => {
    await audit(db, { actorId: "o1", actorRole: "owner", action: "team.invite", entity: "invite", entityId: "long", summary: { email: `${"x".repeat(250)}@example.com` } }, SECRET);
    const [row] = await db.$client<{ summary: { email: string } }[]>`select summary from audit_log where entity_id = 'long'`;
    expect(row?.summary.email).toHaveLength(200);
    expect(row?.summary.email.endsWith("…")).toBe(true);
  });

  it("withAudit keeps a change and its entry together: if the entry fails, the change is undone", async () => {
    await expect(
      withAudit(db, SECRET, async (tx) => {
        await tx.execute(sql`insert into app_setting (key, value) values ('audit_probe', '1'::jsonb)`);
        return { value: 1, entry: { actorId: "o1", actorRole: "owner", action: "team.invite", entity: "invite", summary: { key: "sk-x" } as never } };
      })
    ).rejects.toBeInstanceOf(AuditSummaryError);
    expect((await db.$client`select 1 from app_setting where key = 'audit_probe'`).length).toBe(0);
    const v = await withAudit(db, SECRET, async (tx) => {
      await tx.execute(sql`insert into app_setting (key, value) values ('audit_probe', '1'::jsonb)`);
      return { value: 7, entry: { actorId: "o1", actorRole: "owner", action: "settings.change", entity: "setting", entityId: "audit_probe", summary: { setting: "audit_probe", value: "1" } } };
    });
    expect(v).toBe(7);
    expect((await db.$client`select 1 from audit_log where entity_id = 'audit_probe'`).length).toBe(1);
  });

  it("can't be changed or deleted afterwards", async () => {
    await expect(db.$client`update audit_log set action = 'x'`).rejects.toThrow(/append-only/);
    await expect(db.$client`delete from audit_log`).rejects.toThrow(/append-only/);
  });
});

describe("listAudit", () => {
  beforeAll(async () => {
    await db.$client`insert into audit_log (actor_id, actor_role, action, entity, at) values
      ('a1', 'admin', 'auth.sign_in', 'session', '2026-11-20T10:00:00Z'),
      ('a1', 'admin', 'team.revoke', 'invite', '2026-11-22T10:00:00Z'),
      ('o1', 'owner', 'auth.sign_in', 'session', '2026-11-25T10:00:00Z')`;
  });

  it("filters by person, action and dates, newest first, with the person's email", async () => {
    const byActor = await listAudit(db, { actorId: "a1" });
    expect(byActor.entries.map((e) => e.action)).toEqual(["team.revoke", "auth.sign_in"]);
    expect(byActor.entries[0]?.actorEmail).toBe("admin@example.com");
    const signIns = await listAudit(db, { actions: ["auth.sign_in"] });
    expect(signIns.entries).toHaveLength(2);
    const window = await listAudit(db, { from: new Date("2026-11-21T00:00:00Z"), to: new Date("2026-11-23T00:00:00Z") });
    expect(window.entries.map((e) => e.action)).toEqual(["team.revoke"]);
  });

  it("pages 50 at a time with a cursor", async () => {
    for (let i = 0; i < 55; i++) await audit(db, { actorId: "o1", actorRole: "owner", action: "auth.sign_in", entity: "session", summary: {} }, SECRET);
    const first = await listAudit(db, {});
    expect(first.entries).toHaveLength(50);
    expect(first.nextCursor).not.toBeNull();
    const second = await listAudit(db, { cursor: first.nextCursor! });
    expect(second.entries.length).toBeGreaterThan(0);
    expect(second.entries[0]!.id).toBeLessThan(first.entries.at(-1)!.id);
  });
});
