import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptInvite, hashInviteToken, newInviteToken } from "../src/invite";
import { acceptRoleOffer } from "../src/offers";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date();

async function invite(email: string, role: "admin" | "moderator" | "reader", expiresAt = new Date(now.getTime() + 72 * 3600_000), invitedBy: string | null = "own") {
  const { token, hash } = await newInviteToken();
  await db.$client`insert into invite (email, role, token_hash, invited_by, expires_at) values (${email}, ${role}, ${hash}, ${invitedBy}, ${expiresAt.toISOString()})`;
  return token;
}
async function person(id: string, email: string, twoStep = true) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${email}, true, ${twoStep})`;
  return { id, email, twoFactorEnabled: twoStep };
}

beforeAll(async () => {
  await resetAndMigrate(url);
  // The database checks, at accept time, that the sender may still give the role.
  await db.$client`insert into "user" (id, name, email, email_verified) values ('own', 'own', 'own@example.com', true), ('adm', 'adm', 'adm@example.com', true)`;
  await db.$client`insert into staff_role (user_id, role) values ('own', 'owner'), ('adm', 'admin')`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("invite tokens", () => {
  it("are 43-character base64url secrets stored only as a SHA-256 hash", async () => {
    const { token, hash } = await newInviteToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(hash).toHaveLength(32);
    expect(Buffer.from(await hashInviteToken(token)).equals(Buffer.from(hash))).toBe(true);
  });
});

describe("acceptInvite", () => {
  it("records who sent the invite, and survives two accepts at once", async () => {
    const { token, hash } = await newInviteToken();
    await db.$client`insert into invite (email, role, token_hash, invited_by, expires_at) values ('race@example.com', 'reader', ${hash}, 'adm', now() + interval '1 hour')`;
    const u = await person("race1", "race@example.com");
    const results = await Promise.all([acceptInvite(db, { token, userId: u.id }), acceptInvite(db, { token, userId: u.id })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [row] = await db.$client<{ granted_by: string }[]>`select granted_by from reader_role where user_id = 'race1'`;
    expect(row?.granted_by).toBe("adm");
  });

  it("activates the role once, for the invited email, with 2-step on", async () => {
    const token = await invite("Reader@Example.com", "reader");
    const u = await person("r1", "reader@example.com");
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: true, role: "reader" });
    const [row] = await db.$client<{ n: number }[]>`select count(*)::int as n from reader_role where user_id = 'r1' and revoked_at is null`;
    expect(row?.n).toBe(1);
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an expired invite", async () => {
    const token = await invite("late@example.com", "moderator", new Date(now.getTime() - 1000));
    expect(await acceptInvite(db, { token, userId: (await person("l1", "late@example.com")).id })).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses someone signed in with a different email", async () => {
    const token = await invite("right@example.com", "moderator");
    expect(await acceptInvite(db, { token, userId: (await person("w1", "wrong@example.com")).id })).toEqual({ ok: false, reason: "wrong_email" });
  });

  it("asks for 2-step sign-in first, and leaves the invite usable", async () => {
    const token = await invite("later@example.com", "admin");
    const u = await person("t1", "later@example.com", false);
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: false, reason: "two_step_required" });
    await db.$client`update "user" set two_factor_enabled = true where id = ${u.id}`;
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: true, role: "admin" });
  });

  it("refuses a revoked invite and a made-up token", async () => {
    const token = await invite("gone@example.com", "reader");
    await db.$client`update invite set revoked_at = now() where email = 'gone@example.com'`;
    const u = await person("g1", "gone@example.com");
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: false, reason: "invalid" });
    expect(await acceptInvite(db, { token: "x".repeat(43), userId: u.id })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses a portal role to someone who already has one", async () => {
    const u = await person("h1", "has@example.com");
    await db.$client`insert into staff_role (user_id, role) values ('h1', 'moderator')`;
    const token = await invite("has@example.com", "admin");
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: false, reason: "has_role" });
  });

  it("makes staff readers only through the owner, and checks the guidelines version", async () => {
    const notOwner = await invite("has@example.com", "reader", undefined, "adm");
    expect(await acceptInvite(db, { token: notOwner, userId: "h1" })).toEqual({ ok: false, reason: "staff_reader_owner_only" });
    const [v] = await db.$client<{ id: string }[]>`insert into text_version (kind, snapshot) values ('guidelines', '{}') returning id`;
    const fromOwner = await invite("has@example.com", "reader", undefined, "own");
    expect(await acceptInvite(db, { token: fromOwner, userId: "h1", guidelines: 0 })).toEqual({ ok: false, reason: "guidelines_changed" });
    expect(await acceptInvite(db, { token: fromOwner, userId: "h1", guidelines: Number(v!.id) })).toEqual({ ok: true, role: "reader" });
  });
});

describe("acceptRoleOffer", () => {
  async function offer(userId: string, by: string | null, reader: boolean, portal: "admin" | "moderator" | null) {
    const [row] = await db.$client<{ id: string }[]>`insert into role_offer (user_id, reader, portal_role, offered_by, expires_at) values (${userId}, ${reader}, ${portal}, ${by}, now() + interval '1 hour') returning id`;
    return row!.id;
  }
  const guidelines = async () => Number((await db.$client<{ v: string }[]>`select coalesce(max(id), 0) as v from text_version where kind = 'guidelines'`)[0]!.v);

  it("gives the offered roles and says which", async () => {
    await person("of1", "of1@example.com");
    const id = await offer("of1", "own", true, "admin");
    expect(await acceptRoleOffer(db, { offerId: id, userId: "of1", guidelines: await guidelines() })).toEqual({ ok: true, roles: { portal: "admin", reader: true } });
    await person("of2", "of2@example.com");
    expect(await acceptRoleOffer(db, { offerId: await offer("of2", "own", false, "moderator"), userId: "of2", guidelines: 0 })).toEqual({ ok: true, roles: { portal: "moderator", reader: false } });
  });

  it("refuses a malformed id, someone else's offer and an admin adding the reader role to staff", async () => {
    expect(await acceptRoleOffer(db, { offerId: "nope", userId: "of2", guidelines: 0 })).toEqual({ ok: false, reason: "invalid" });
    expect(await acceptRoleOffer(db, { offerId: await offer("of1", "own", false, "moderator"), userId: "of2", guidelines: 0 })).toEqual({ ok: false, reason: "invalid" });
    expect(await acceptRoleOffer(db, { offerId: await offer("of2", "adm", true, null), userId: "of2", guidelines: await guidelines() })).toEqual({ ok: false, reason: "staff_reader_owner_only" });
  });
});
