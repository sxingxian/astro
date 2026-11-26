import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import type { Mail } from "@astro/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { changeRole, createInvite, listTeam, removeRole, revokeInvite } from "@/lib/team";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-27T03:00:00Z");
const sent: Mail[] = [];
const deps = { sendMail: async (m: Mail) => void sent.push(m), appUrl: "https://astroapp.example" };
const owner = { id: "o1", role: "owner" as const };
const admin = { id: "a1", role: "admin" as const };

async function person(id: string, email: string, role?: string) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${email}, true, true)`;
  if (role) await db.$client`insert into staff_role (user_id, role) values (${id}, ${role})`;
}
async function adminSession(userId: string) {
  await db.$client`insert into session (id, expires_at, token, user_id, surface) values (${crypto.randomUUID()}, now() + interval '1 hour', ${crypto.randomUUID()}, ${userId}, 'admin')`;
}

beforeAll(async () => {
  await resetAndMigrate(url);
  await person("o1", "owner@example.com", "owner");
  await person("a1", "admin@example.com", "admin");
});
afterAll(async () => {
  await db.$client.end();
});

describe("team", () => {
  it("emails an app link for a new invite and lists it as pending", async () => {
    const { inviteId } = await createInvite(db, owner, { email: "New.Reader@Example.com", role: "reader" }, now, deps);
    const mail = sent.at(-1);
    expect(mail?.to).toBe("new.reader@example.com");
    expect(mail?.text).toMatch(/https:\/\/astroapp\.example\/invite#[A-Za-z0-9_-]{43}/);
    expect(mail?.text).toMatch(/30 Nov 2026/); // 72 hours after 27 Nov 03:00 UTC
    const team = await listTeam(db, now);
    expect(team.invites.find((i) => i.id === inviteId)).toMatchObject({ email: "new.reader@example.com", role: "reader", status: "pending" });
    const [row] = await db.$client<{ n: number }[]>`select count(*)::int as n from invite where token_hash is not null and email = 'new.reader@example.com'`;
    expect(row?.n).toBe(1);
  });

  it("replaces an earlier pending invite for the same email", async () => {
    await createInvite(db, owner, { email: "twice@example.com", role: "moderator" }, now, deps);
    await createInvite(db, owner, { email: "twice@example.com", role: "moderator" }, now, deps);
    const team = await listTeam(db, now);
    expect(team.invites.filter((i) => i.email === "twice@example.com" && i.status === "pending")).toHaveLength(1);
  });

  it("lets an admin invite moderators and readers but never admins", async () => {
    await expect(createInvite(db, admin, { email: "x@example.com", role: "admin" }, now, deps)).rejects.toThrow(/forbidden_role/);
    await createInvite(db, admin, { email: "mod@example.com", role: "moderator" }, now, deps);
  });

  it("refuses to invite someone who already has a role", async () => {
    await expect(createInvite(db, owner, { email: "admin@example.com", role: "reader" }, now, deps)).rejects.toThrow(/has_role/);
  });

  it("cancels an invite", async () => {
    const { inviteId } = await createInvite(db, owner, { email: "cancel@example.com", role: "reader" }, now, deps);
    await revokeInvite(db, owner, inviteId);
    expect((await listTeam(db, now)).invites.find((i) => i.id === inviteId)?.status).toBe("cancelled");
  });

  it("removing someone deletes their portal sessions, and the owner can't be removed", async () => {
    await person("m1", "m1@example.com", "moderator");
    await adminSession("m1");
    await removeRole(db, admin, "m1");
    const [s] = await db.$client<{ n: number }[]>`select count(*)::int as n from session where user_id = 'm1' and surface = 'admin'`;
    expect(s?.n).toBe(0);
    await expect(removeRole(db, admin, "o1")).rejects.toThrow(/owner/);
    await expect(removeRole(db, owner, "o1")).rejects.toThrow(/self/);
  });

  it("changes a role within what the actor may grant, and signs the person out of the portal", async () => {
    await person("m2", "m2@example.com", "moderator");
    await adminSession("m2");
    await changeRole(db, owner, "m2", "admin");
    const [r] = await db.$client<{ role: string }[]>`select role from staff_role where user_id = 'm2'`;
    expect(r?.role).toBe("admin");
    const [s] = await db.$client<{ n: number }[]>`select count(*)::int as n from session where user_id = 'm2' and surface = 'admin'`;
    expect(s?.n).toBe(0);
    await expect(changeRole(db, admin, "m2", "moderator")).rejects.toThrow(/forbidden/);
    await expect(changeRole(db, admin, "a1", "reader")).rejects.toThrow(/self/);
  });
});
