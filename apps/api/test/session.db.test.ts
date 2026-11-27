import { createHmac, randomUUID } from "node:crypto";
import { createDb, createHttpDb, type AnyDb } from "@astro/db";
import { neonFetchOverPostgres, resetAndMigrate } from "@astro/db/testing";
import postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { lookupSession, sessionToken } from "../src/session";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");
const SECRET = "test-better-auth-secret-0123456789abcdef";

const admin = postgres(url, { max: 1, onnotice: () => {} });
const tcp = createDb(webUrl);
const fake = neonFetchOverPostgres(webUrl);
const http = createHttpDb(webUrl, { fetch: fake.fetch });

/** The cookie value Better Auth sets: `token.base64(HMAC-SHA-256(secret, token))`, URL-encoded. */
export const signedCookie = (token: string, secret = SECRET) => encodeURIComponent(`${token}.${createHmac("sha256", secret).update(token).digest("base64")}`);

async function person(opts: { surface?: string; expired?: boolean; disabled?: boolean; reader?: boolean } = {}) {
  const uid = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  await admin`insert into "user" (id, email, name, email_verified, time_zone, disabled_at) values (${uid}, ${`${uid}@example.com`}, '', true, 'Asia/Singapore', ${opts.disabled ? new Date() : null})`;
  await admin`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${opts.expired ? new Date(Date.now() - 1000) : new Date(Date.now() + 86_400_000)}, ${opts.surface ?? "app"})`;
  if (opts.reader) await admin`insert into reader_role (user_id, granted_by) values (${uid}, ${uid})`;
  return { uid, token };
}

beforeAll(async () => {
  await resetAndMigrate(url);
});
afterAll(async () => {
  await admin.end({ timeout: 1 });
  await tcp.$client.end({ timeout: 1 });
  await fake.end();
});

describe("sessionToken", () => {
  it("reads the signed sign-in cookie, under either name", async () => {
    expect(await sessionToken(`astro.session_token=${signedCookie("abc")}`, SECRET)).toBe("abc");
    expect(await sessionToken(`x=1; __Secure-astro.session_token=${signedCookie("abc")}; y=2`, SECRET)).toBe("abc");
  });

  it("refuses a missing cookie, a bad signature or another secret", async () => {
    expect(await sessionToken(null, SECRET)).toBeNull();
    expect(await sessionToken("astro.session_token=abc.notasignature", SECRET)).toBeNull();
    expect(await sessionToken(`astro.session_token=${signedCookie("abc", "another-secret-0123456789abcdef")}`, SECRET)).toBeNull();
    expect(await sessionToken("astro.session_token=%%%", SECRET)).toBeNull();
  });
});

for (const [name, db] of [["postgres.js", tcp], ["HTTPS", http]] as [string, AnyDb][]) {
  describe(`lookupSession (${name})`, () => {
    it("finds a live app session with its person and reader role", async () => {
      const p = await person({ reader: true });
      expect(await lookupSession(db, p.token)).toMatchObject({ uid: p.uid, reader: true, timeZone: "Asia/Singapore" });
      const q = await person();
      expect(await lookupSession(db, q.token)).toMatchObject({ uid: q.uid, reader: false });
    });

    it("refuses expired, portal, disabled and unknown sessions", async () => {
      expect(await lookupSession(db, (await person({ expired: true })).token)).toBeNull();
      expect(await lookupSession(db, (await person({ surface: "admin" })).token)).toBeNull();
      expect(await lookupSession(db, (await person({ disabled: true })).token)).toBeNull();
      expect(await lookupSession(db, "no-such-token")).toBeNull();
    });
  });
}
