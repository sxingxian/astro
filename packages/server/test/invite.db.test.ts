import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptInvite, hashInviteToken, newInviteToken } from "../src/invite";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date();

async function invite(email: string, role: "admin" | "moderator" | "reader", expiresAt = new Date(now.getTime() + 72 * 3600_000)) {
  const { token, hash } = await newInviteToken();
  await db.$client`insert into invite (email, role, token_hash, expires_at) values (${email}, ${role}, ${hash}, ${expiresAt.toISOString()})`;
  return token;
}
async function person(id: string, email: string, twoStep = true) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${email}, true, ${twoStep})`;
  return { id, email, twoFactorEnabled: twoStep };
}

beforeAll(async () => {
  await resetAndMigrate(url);
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
    await db.$client`insert into "user" (id, name, email, email_verified) values ('inviter', 'i', 'inviter@example.com', true) on conflict do nothing`;
    const { token, hash } = await newInviteToken();
    await db.$client`insert into invite (email, role, token_hash, invited_by, expires_at) values ('race@example.com', 'reader', ${hash}, 'inviter', now() + interval '1 hour')`;
    const u = await person("race1", "race@example.com");
    const results = await Promise.all([acceptInvite(db, { token, userId: u.id }), acceptInvite(db, { token, userId: u.id })]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const [row] = await db.$client<{ granted_by: string }[]>`select granted_by from staff_role where user_id = 'race1'`;
    expect(row?.granted_by).toBe("inviter");
  });

  it("activates the role once, for the invited email, with 2-step on", async () => {
    const token = await invite("Reader@Example.com", "reader");
    const u = await person("r1", "reader@example.com");
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: true, role: "reader" });
    const [row] = await db.$client<{ role: string }[]>`select role from staff_role where user_id = 'r1'`;
    expect(row?.role).toBe("reader");
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

  it("refuses someone who already has a role", async () => {
    const u = await person("h1", "has@example.com");
    await db.$client`insert into staff_role (user_id, role) values ('h1', 'moderator')`;
    const token = await invite("has@example.com", "reader");
    expect(await acceptInvite(db, { token, userId: u.id })).toEqual({ ok: false, reason: "has_role" });
  });
});
