import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptInvite, hashInviteToken, newInviteToken } from "../src/invite";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-27T02:00:00Z");

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
  it("activates the role once, for the invited email, with 2-step on", async () => {
    const token = await invite("Reader@Example.com", "reader");
    const u = await person("r1", "reader@example.com");
    expect(await acceptInvite(db, { token, user: u, now })).toEqual({ ok: true, role: "reader" });
    const [row] = await db.$client<{ role: string }[]>`select role from staff_role where user_id = 'r1'`;
    expect(row?.role).toBe("reader");
    expect(await acceptInvite(db, { token, user: u, now })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses an expired invite", async () => {
    const token = await invite("late@example.com", "moderator", new Date(now.getTime() - 1000));
    expect(await acceptInvite(db, { token, user: await person("l1", "late@example.com"), now })).toEqual({ ok: false, reason: "expired" });
  });

  it("refuses someone signed in with a different email", async () => {
    const token = await invite("right@example.com", "moderator");
    expect(await acceptInvite(db, { token, user: await person("w1", "wrong@example.com"), now })).toEqual({ ok: false, reason: "wrong_email" });
  });

  it("asks for 2-step sign-in first, and leaves the invite usable", async () => {
    const token = await invite("later@example.com", "admin");
    const u = await person("t1", "later@example.com", false);
    expect(await acceptInvite(db, { token, user: u, now })).toEqual({ ok: false, reason: "two_step_required" });
    expect(await acceptInvite(db, { token, user: { ...u, twoFactorEnabled: true }, now })).toEqual({ ok: true, role: "admin" });
  });

  it("refuses a revoked invite and a made-up token", async () => {
    const token = await invite("gone@example.com", "reader");
    await db.$client`update invite set revoked_at = now() where email = 'gone@example.com'`;
    const u = await person("g1", "gone@example.com");
    expect(await acceptInvite(db, { token, user: u, now })).toEqual({ ok: false, reason: "invalid" });
    expect(await acceptInvite(db, { token: "x".repeat(43), user: u, now })).toEqual({ ok: false, reason: "invalid" });
  });

  it("refuses someone who already has a role", async () => {
    const u = await person("h1", "has@example.com");
    await db.$client`insert into staff_role (user_id, role) values ('h1', 'moderator')`;
    const token = await invite("has@example.com", "reader");
    expect(await acceptInvite(db, { token, user: u, now })).toEqual({ ok: false, reason: "has_role" });
  });
});
