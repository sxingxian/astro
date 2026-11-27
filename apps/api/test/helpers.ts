import { randomUUID } from "node:crypto";
import { createDb } from "@astro/db";
import { createHttpDb } from "@astro/db/http";
import { neonFetchOverPostgres } from "@astro/db/testing";
import { serializeSignedCookie } from "better-call";
import postgres from "postgres";

const url = process.env.DATABASE_URL_TEST;
if (!url) throw new Error("DATABASE_URL_TEST is not set");
export const dbUrl = url;
export const webUrl = url.replace("migrator:migrator", "astro_web:astro_web");

/** The Worker's settings in tests: local http, outbox mail, Turnstile and HIBP off. */
export const env = {
  DATABASE_URL: webUrl,
  BETTER_AUTH_SECRET: "test-better-auth-secret-0123456789abcdef",
  PASS_SECRET: "test-pass-secret-0123456789abcdefghij",
  APP_URL: "http://127.0.0.1:8791",
  EMAIL_FROM: "Astro <test@example.com>",
  MAIL_DRIVER: "outbox",
  TURNSTILE_MODE: "off",
  HIBP_CHECK: "off",
  PUBLIC_TURNSTILE_SITE_KEY: "1x00000000000000000000AA",
  MAINTENANCE_CACHE_SECONDS: "0"
};

export const admin = postgres(url, { max: 1, onnotice: () => {} });
export const tcp = createDb(webUrl);
export const fake = neonFetchOverPostgres(webUrl);
export const http = createHttpDb(webUrl, { fetch: fake.fetch });

export async function closeAll() {
  await admin.end({ timeout: 1 });
  await tcp.$client.end({ timeout: 1 });
  await fake.end();
}

/** The cookie value exactly as Better Auth sets it (signed by better-call itself, so a format change shows here). */
export async function signed(token: string, secret = env.BETTER_AUTH_SECRET) {
  const header = await serializeSignedCookie("x", token, secret);
  return header.slice(2, header.indexOf(";") > 0 ? header.indexOf(";") : undefined);
}

/** A person with a live app session. `cookie` is the sign-in cookie for local http (no __Secure- prefix). */
export async function person(opts: { disabled?: boolean; expiresInHours?: number; reader?: boolean; surface?: string; expired?: boolean } = {}) {
  const uid = randomUUID();
  const token = randomUUID().replace(/-/g, "");
  await admin`insert into "user" (id, email, name, email_verified, time_zone, disabled_at) values (${uid}, ${`${uid}@example.com`}, '', true, 'Asia/Singapore', ${opts.disabled ? new Date() : null})`;
  await admin`insert into session (id, token, user_id, expires_at, surface) values (${randomUUID()}, ${token}, ${uid}, ${opts.expired ? new Date(Date.now() - 1000) : new Date(Date.now() + (opts.expiresInHours ?? 24) * 3_600_000)}, ${opts.surface ?? "app"})`;
  if (opts.reader) await admin`insert into reader_role (user_id, granted_by) values (${uid}, ${uid})`;
  return { uid, token, cookie: `astro.session_token=${await signed(token)}` };
}

/** The `astro.pass` value a response set, if any. */
export const passFrom = (res: Response) => /astro\.pass=([^;]*)/.exec(res.headers.get("set-cookie") ?? "")?.[1];

/** A stand-in for the Worker's execution context: collects background work so tests can wait for it. */
export function execution() {
  const pending: Promise<unknown>[] = [];
  const ctx = { waitUntil: (p: Promise<unknown>) => void pending.push(p), passThroughOnException: () => {}, props: {} } as unknown as ExecutionContext;
  return { ctx, settle: async () => void (await Promise.allSettled(pending.splice(0))) };
}

let ip = 0;
/** A fresh client address per call, so rate limits keyed on the address don't carry across tests. */
export const freshIp = () => `10.20.${Math.floor(++ip / 250)}.${(ip % 250) + 1}`;
