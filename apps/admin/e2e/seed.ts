import { createDb } from "@astro/db";
import { createPasswordHasher } from "@astro/server";
import { makeSignature, symmetricEncrypt } from "better-auth/crypto";
import * as OTPAuth from "otpauth";

// The development secret from .dev.vars.example; both Workers use it locally.
export const AUTH_SECRET = "dev-only-secret-change-me-0123456789abcdef";
export const PASSWORD = "correct horse battery staple";

const url = () => {
  const u = process.env.DATABASE_URL_TEST;
  if (!u) throw new Error("DATABASE_URL_TEST is not set");
  return u;
};

export interface Seeded {
  id: string;
  email: string;
  totp?: OTPAuth.TOTP;
}

/** Creates a verified account with a password, an optional portal role and an optional authenticator. */
export async function seedPerson(opts: { email: string; role?: "owner" | "admin" | "moderator" | "reader"; twoStep?: boolean; disabled?: boolean }): Promise<Seeded> {
  const db = createDb(url());
  try {
    const id = crypto.randomUUID();
    const hash = await createPasswordHasher(db).hash(PASSWORD);
    await db.$client`insert into "user" (id, name, email, email_verified, two_factor_enabled, disabled_at)
      values (${id}, ${opts.email.split("@")[0] ?? "x"}, ${opts.email}, true, ${Boolean(opts.twoStep)}, case when ${Boolean(opts.disabled)} then now() end)`;
    await db.$client`insert into account (id, account_id, provider_id, user_id, password) values (${crypto.randomUUID()}, ${id}, 'credential', ${id}, ${hash})`;
    // There can only be one owner: a test that needs one takes over from any earlier test's owner.
    if (opts.role === "owner") await db.$client`delete from staff_role where role = 'owner'`;
    if (opts.role) await db.$client`insert into staff_role (user_id, role) values (${id}, ${opts.role})`;
    let totp: OTPAuth.TOTP | undefined;
    if (opts.twoStep) {
      const raw = crypto.randomUUID().replaceAll("-", "").slice(0, 32);
      const secret = await symmetricEncrypt({ key: AUTH_SECRET, data: raw });
      await db.$client`insert into two_factor (id, secret, backup_codes, user_id) values (${crypto.randomUUID()}, ${secret}, 'x', ${id})`;
      totp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromUTF8(raw), digits: 6, period: 30 });
    }
    return { id, email: opts.email, totp };
  } finally {
    await db.$client.end();
  }
}

/** A signed session cookie value for a session made directly in the database on `surface`. */
export async function sessionCookie(userId: string, surface: "app" | "admin"): Promise<string> {
  const db = createDb(url());
  try {
    const token = crypto.randomUUID().replaceAll("-", "");
    await db.$client`insert into session (id, expires_at, token, user_id, surface) values (${crypto.randomUUID()}, now() + interval '1 hour', ${token}, ${userId}, ${surface})`;
    return encodeURIComponent(`${token}.${await makeSignature(token, AUTH_SECRET)}`);
  } finally {
    await db.$client.end();
  }
}
