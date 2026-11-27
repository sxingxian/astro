import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { acceptGuidelines, pendingOffer, readerStatus } from "@/lib/readers";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const publish = async () => Number((await db.$client<{ id: string }[]>`insert into text_version (kind, snapshot) values ('guidelines', '{}') returning id`)[0]!.id);

beforeAll(async () => {
  await resetAndMigrate(url);
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values ('r1', 'r1', 'r1@example.com', true, true), ('p1', 'p1', 'p1@example.com', true, true)`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("readerStatus", () => {
  it("is not a reader without the role", async () => {
    expect(await readerStatus(db, "p1")).toEqual({ reader: false, guidelinesVersion: 0, accepted: false });
  });

  it("asks a reader to accept again after the guidelines are republished, and only the newest version counts", async () => {
    await db.$client`insert into reader_role (user_id) values ('r1')`;
    await db.$client`insert into guideline_acceptance (user_id, version) values ('r1', 0)`;
    expect(await readerStatus(db, "r1")).toEqual({ reader: true, guidelinesVersion: 0, accepted: true });
    const v = await publish();
    expect(await readerStatus(db, "r1")).toEqual({ reader: true, guidelinesVersion: v, accepted: false });
    await expect(acceptGuidelines(db, "r1", 0)).rejects.toThrow(/guidelines_changed/);
    await acceptGuidelines(db, "r1", v);
    expect(await readerStatus(db, "r1")).toEqual({ reader: true, guidelinesVersion: v, accepted: true });
  });

  it("won't record guidelines for someone who isn't a reader", async () => {
    await expect(acceptGuidelines(db, "p1", (await readerStatus(db, "p1")).guidelinesVersion)).rejects.toThrow(/not_reader/);
  });
});

describe("pendingOffer", () => {
  it("finds the newest live offer for the account, and nothing once it's withdrawn or expired", async () => {
    expect(await pendingOffer(db, "p1")).toBeNull();
    await db.$client`insert into role_offer (user_id, reader, portal_role, expires_at) values ('p1', true, null, now() - interval '1 minute')`;
    expect(await pendingOffer(db, "p1")).toBeNull();
    await db.$client`insert into role_offer (user_id, reader, portal_role, expires_at) values ('p1', true, 'moderator', now() + interval '1 hour')`;
    expect(await pendingOffer(db, "p1")).toMatchObject({ reader: true, portalRole: "moderator" });
    await db.$client`update role_offer set revoked_at = now() where user_id = 'p1'`;
    expect(await pendingOffer(db, "p1")).toBeNull();
  });
});
