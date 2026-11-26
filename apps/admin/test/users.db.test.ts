import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { disableUser, enableUser, findUser, resetTwoStep } from "@/lib/users";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const owner = { id: "o1", role: "owner" as const };
const mod = { id: "m1", role: "moderator" as const };

async function person(id: string, email: string, role?: string) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${email}, true, true)`;
  await db.$client`insert into two_factor (id, secret, backup_codes, user_id) values (${crypto.randomUUID()}, 's', 'b', ${id})`;
  if (role) await db.$client`insert into staff_role (user_id, role) values (${id}, ${role})`;
}
async function session(userId: string, surface = "app") {
  await db.$client`insert into session (id, expires_at, token, user_id, surface) values (${crypto.randomUUID()}, now() + interval '1 hour', ${crypto.randomUUID()}, ${userId}, ${surface})`;
}
const sessionCount = async (userId: string) => (await db.$client<{ n: number }[]>`select count(*)::int as n from session where user_id = ${userId}`)[0]!.n;

beforeAll(async () => {
  await resetAndMigrate(url);
  await person("o1", "owner@example.com", "owner");
  await person("m1", "mod@example.com", "moderator");
  await person("a1", "admin@example.com", "admin");
  await person("u1", "Seeker@Example.com");
  await db.$client`insert into draw_session (user_id, spread, local_day, time_zone, status, completed_at) values
    ('u1', 'one', '2026-11-20', 'UTC', 'complete', now()), ('u1', 'three', '2026-11-21', 'UTC', 'complete', now()), ('u1', 'one', '2026-11-22', 'UTC', 'picking', null)`;
  await db.$client`insert into reading_note (session_id, body) select id, 'a private note' from draw_session where user_id = 'u1' limit 1`;
  await session("u1");
});
afterAll(async () => {
  await db.$client.end();
});

describe("findUser", () => {
  it("matches the exact email in any case and returns only the support facts", async () => {
    const u = await findUser(db, "seeker@example.COM");
    expect(Object.keys(u ?? {}).sort()).toEqual(["createdAt", "disabledAt", "email", "emailVerified", "id", "lastSignInAt", "readingCount", "twoFactorEnabled"]);
    expect(u?.readingCount).toBe(2);
    expect(u?.lastSignInAt).toBeInstanceOf(Date);
    expect(JSON.stringify(u)).not.toContain("private note");
  });

  it("never matches part of an email", async () => {
    expect(await findUser(db, "seeker@")).toBeNull();
    expect(await findUser(db, "%@example.com")).toBeNull();
    expect(await findUser(db, "eeker@example.com")).toBeNull();
  });
});

describe("disable, enable, reset 2-step", () => {
  it("disabling signs the person out everywhere; enabling lets them back", async () => {
    await session("u1", "app");
    await disableUser(db, mod, "u1");
    expect(await sessionCount("u1")).toBe(0);
    expect((await findUser(db, "seeker@example.com"))?.disabledAt).toBeInstanceOf(Date);
    await enableUser(db, mod, "u1");
    expect((await findUser(db, "seeker@example.com"))?.disabledAt).toBeNull();
  });

  it("resetting 2-step removes the authenticator and signs them out", async () => {
    await session("u1");
    await resetTwoStep(db, mod, "u1");
    const u = await findUser(db, "seeker@example.com");
    expect(u?.twoFactorEnabled).toBe(false);
    expect((await db.$client`select 1 from two_factor where user_id = 'u1'`).length).toBe(0);
    expect(await sessionCount("u1")).toBe(0);
  });

  it("only the owner can act on staff accounts, and nobody on themselves", async () => {
    await expect(disableUser(db, mod, "a1")).rejects.toThrow(/staff_owner_only/);
    await expect(resetTwoStep(db, mod, "a1")).rejects.toThrow(/staff_owner_only/);
    await expect(disableUser(db, owner, "o1")).rejects.toThrow(/self/);
    await session("a1", "admin");
    await disableUser(db, owner, "a1");
    expect(await sessionCount("a1")).toBe(0);
  });

  it("refuses an unknown person", async () => {
    await expect(disableUser(db, owner, "nobody")).rejects.toThrow(/not_found/);
  });
});
