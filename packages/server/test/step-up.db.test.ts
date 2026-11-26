import { createDb } from "@astro/db";
import { resetAndMigrate } from "@astro/db/testing";
import { symmetricEncrypt } from "better-auth/crypto";
import * as OTPAuth from "otpauth";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { burnSignInStep, requireStepUp, StepUpFailed } from "../src/step-up";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
const db = createDb(url);
const authSecret = "test-secret-0123456789abcdef0123456789";
const raw = "ABCDEFGHIJKLMNOPQRSTUVWXYZ012345"; // Better Auth stores a 32-character random string
const totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromUTF8(raw), digits: 6, period: 30 });

beforeAll(async () => {
  await resetAndMigrate(url);
  await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled) values ('u1', 'U', 'u1@example.com', true, true), ('u2', 'V', 'u2@example.com', true, true), ('u4', 'X', 'u4@example.com', true, true), ('u5', 'Y', 'u5@example.com', true, true)`;
  const secret = await symmetricEncrypt({ key: authSecret, data: raw });
  await db.$client`insert into two_factor (id, secret, backup_codes, user_id) values ('t1', ${secret}, 'x', 'u1'), ('t2', ${secret}, 'x', 'u2'), ('t4', ${secret}, 'x', 'u4'), ('t5', ${secret}, 'x', 'u5')`;
});
afterAll(async () => {
  await db.$client.end();
});

describe("requireStepUp", () => {
  it("passes with the current code", async () => {
    const now = new Date("2026-11-27T01:00:00Z");
    await expect(requireStepUp(db, { userId: "u1", code: totp.generate({ timestamp: now.getTime() }), authSecret, now })).resolves.toBeUndefined();
  });

  it("refuses the same code a second time", async () => {
    const now = new Date("2026-11-27T02:00:00Z");
    const code = totp.generate({ timestamp: now.getTime() });
    await requireStepUp(db, { userId: "u1", code, authSecret, now });
    await expect(requireStepUp(db, { userId: "u1", code, authSecret, now: new Date(now.getTime() + 5_000) })).rejects.toThrow(StepUpFailed);
  });

  it("locks after five wrong codes in 15 minutes, even if the next one is right", async () => {
    const now = new Date("2026-11-27T03:00:00Z");
    for (let i = 0; i < 5; i++) await expect(requireStepUp(db, { userId: "u2", code: "000000", authSecret, now })).rejects.toThrow(StepUpFailed);
    const right = totp.generate({ timestamp: now.getTime() });
    await expect(requireStepUp(db, { userId: "u2", code: right, authSecret, now })).rejects.toThrow(/too_many/);
  });

  it("can't be raced: many guesses at once still check at most five codes", async () => {
    const now = new Date("2026-11-27T04:00:00Z");
    const results = await Promise.allSettled(Array.from({ length: 30 }, (_, i) => requireStepUp(db, { userId: "u4", code: String(100000 + i), authSecret, now })));
    const reasons = results.map((r) => (r.status === "rejected" ? (r.reason as StepUpFailed).reason : "passed"));
    expect(reasons.filter((r) => r === "wrong_code" || r === "passed").length).toBeLessThanOrEqual(5);
    expect(reasons.filter((r) => r === "too_many").length).toBeGreaterThanOrEqual(25);
  });

  it("won't take the code that was just used to sign in", async () => {
    const now = new Date("2026-11-27T05:00:00Z");
    await burnSignInStep(db, "u5", now);
    await expect(requireStepUp(db, { userId: "u5", code: totp.generate({ timestamp: now.getTime() }), authSecret, now })).rejects.toThrow(/replayed/);
    const later = new Date(now.getTime() + 65_000);
    await expect(requireStepUp(db, { userId: "u5", code: totp.generate({ timestamp: later.getTime() }), authSecret, now: later })).resolves.toBeUndefined();
  });

  it("fails for someone without an authenticator", async () => {
    await db.$client`insert into "user" (id, name, email, email_verified) values ('u3', 'W', 'u3@example.com', true)`;
    await expect(requireStepUp(db, { userId: "u3", code: "123456", authSecret, now: new Date() })).rejects.toThrow(/no_authenticator/);
  });
});
