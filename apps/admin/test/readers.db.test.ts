import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import type { Mail } from "@astro/server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { addReaderToSelf, offerRole, removeReader, revokeOffer } from "@/lib/readers";
import { listTeam } from "@/lib/team";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const now = new Date("2026-11-27T03:00:00Z");
const sent: Mail[] = [];
const deps = { sendMail: async (m: Mail) => void sent.push(m), appUrl: "https://astroapp.example" };
const owner = { id: "o1", role: "owner" as const };
const admin = { id: "a1", role: "admin" as const };
const mod = { id: "m1", role: "moderator" as const };

async function person(id: string, role?: string) {
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values (${id}, ${id}, ${id + "@example.com"}, true, true)`;
  if (role) await db.$client`insert into staff_role (user_id, role) values (${id}, ${role})`;
}
const offers = (userId: string) =>
  db.$client<{ id: string; revoked_at: Date | null; reader: boolean; portal_role: string | null }[]>`select id, revoked_at, reader, portal_role from role_offer where user_id = ${userId} order by created_at`;
const readerRow = async (userId: string) => (await db.$client<{ revoked_at: Date | null }[]>`select revoked_at from reader_role where user_id = ${userId}`)[0];

beforeAll(async () => {
  await resetAndMigrate(url);
  await person("o1", "owner");
  await person("a1", "admin");
  await person("m1", "moderator");
  await person("u1");
  await person("u2");
});
afterAll(async () => {
  await db.$client.end();
});

describe("offerRole", () => {
  it("won't let an admin give staff the reader role, or offer admin", async () => {
    await expect(offerRole(db, admin, { userId: "m1", reader: true, portalRole: null }, now, deps)).rejects.toThrow(/forbidden_role/);
    await expect(offerRole(db, admin, { userId: "u1", reader: false, portalRole: "admin" }, now, deps)).rejects.toThrow(/forbidden_role/);
    await expect(offerRole(db, admin, { userId: "u1", reader: true, portalRole: "moderator" }, now, deps)).rejects.toThrow(/forbidden_role/);
    expect(await offers("m1")).toHaveLength(0);
  });

  it("lets an admin offer the reader role to an ordinary account, and emails that account a link to /offer", async () => {
    sent.length = 0;
    const r = await offerRole(db, admin, { userId: "u1", reader: true, portalRole: null }, now, deps);
    expect(r.expiresAt.getTime()).toBe(now.getTime() + 72 * 3600_000);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toBe("u1@example.com");
    expect(sent[0]!.text).toContain("https://astroapp.example/offer");
  });

  it("replaces an earlier pending offer with the new one", async () => {
    const r = await offerRole(db, owner, { userId: "u1", reader: true, portalRole: "moderator" }, now, deps);
    const rows = await offers("u1");
    expect(rows).toHaveLength(2);
    expect(rows[0]!.revoked_at).not.toBeNull();
    expect(rows[1]).toMatchObject({ id: r.offerId, revoked_at: null, reader: true, portal_role: "moderator" });
  });

  it("refuses moderators, self-offers and roles already held", async () => {
    await expect(offerRole(db, mod, { userId: "u2", reader: true, portalRole: null }, now, deps)).rejects.toThrow(/forbidden_role/);
    await expect(offerRole(db, owner, { userId: "o1", reader: true, portalRole: null }, now, deps)).rejects.toThrow(/self/);
    await expect(offerRole(db, owner, { userId: "a1", reader: false, portalRole: "moderator" }, now, deps)).rejects.toThrow(/has_role/);
    await expect(offerRole(db, owner, { userId: "u2", reader: false, portalRole: null }, now, deps)).rejects.toThrow(/invalid_input/);
  });

  it("lists pending offers on Team, and an admin may withdraw one they could have sent", async () => {
    const r = await offerRole(db, admin, { userId: "u2", reader: true, portalRole: null }, now, deps);
    const team = await listTeam(db, now);
    expect(team.offers.find((o) => o.id === r.offerId)).toMatchObject({ email: "u2@example.com", reader: true, portalRole: null });
    const pendingFromOwner = (await offers("u1")).at(-1)!;
    await expect(revokeOffer(db, admin, pendingFromOwner.id)).rejects.toThrow(/forbidden_role/);
    expect(await revokeOffer(db, admin, r.offerId)).toMatchObject({ email: "u2@example.com" });
    expect((await offers("u2")).at(-1)!.revoked_at).not.toBeNull();
  });
});

describe("adding and removing the reader role", () => {
  it("only the owner adds it to themselves", async () => {
    await expect(addReaderToSelf(db, admin)).rejects.toThrow(/forbidden_role/);
    await addReaderToSelf(db, owner);
    expect((await readerRow("o1"))?.revoked_at).toBeNull();
    const team = await listTeam(db, now);
    expect(team.members.find((m) => m.userId === "o1")).toMatchObject({ role: "owner", reader: true });
  });

  it("won't let an admin remove a staff member's reader role", async () => {
    await expect(removeReader(db, admin, "o1")).rejects.toThrow(/forbidden_role/);
    expect((await readerRow("o1"))?.revoked_at).toBeNull();
  });

  it("sets revoked_at instead of deleting, and shows the person as a former reader", async () => {
    await db.$client`insert into reader_role (user_id) values ('u2')`;
    expect(await removeReader(db, admin, "u2")).toEqual({ email: "u2@example.com" });
    expect((await readerRow("u2"))?.revoked_at).not.toBeNull();
    const team = await listTeam(db, now);
    expect(team.members.find((m) => m.userId === "u2")).toMatchObject({ role: null, reader: false, formerReader: true });
    await expect(removeReader(db, admin, "u2")).rejects.toThrow(/not_found/);
  });
});
