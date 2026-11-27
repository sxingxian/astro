import { APP_SESSION_HOURS, APP_SESSION_UPDATE_HOURS } from "@astro/app-core/auth-options";
import { rowsOf, sql, type AnyDb } from "@astro/db";

// Better Auth names the cookie by the address: `__Secure-astro.session_token` on https, `astro.session_token` on
// local http. Only that one name is read, as Better Auth does, so a same-named cookie planted by a sibling
// subdomain can never stand in for the real one.
const SECURE_COOKIE = /(?:^|;\s*)__Secure-astro\.session_token=([^;]+)/;
const PLAIN_COOKIE = /(?:^|;\s*)astro\.session_token=([^;]+)/;
const enc = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();
const keyFor = (secret: string) => {
  let k = keys.get(secret);
  if (!k) keys.set(secret, (k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])));
  return k;
};

/**
 * The session token from Better Auth's sign-in cookie (`token.base64(HMAC-SHA-256(secret, token))`, URL-encoded),
 * if its signature is genuine. `secure`: the app runs on https (production), so the cookie has the `__Secure-`
 * name. Never throws.
 */
export async function sessionToken(cookieHeader: string | null | undefined, secret: string, secure: boolean): Promise<string | null> {
  const m = cookieHeader ? (secure ? SECURE_COOKIE : PLAIN_COOKIE).exec(cookieHeader) : null;
  if (!m?.[1]) return null;
  let value: string;
  try {
    value = decodeURIComponent(m[1]);
  } catch {
    return null;
  }
  const dot = value.lastIndexOf(".");
  if (dot <= 0) return null;
  const token = value.slice(0, dot);
  let sig: Uint8Array<ArrayBuffer>;
  try {
    sig = Uint8Array.from(atob(value.slice(dot + 1)), (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
  return (await crypto.subtle.verify("HMAC", await keyFor(secret), sig, enc.encode(token))) ? token : null;
}

export interface SessionInfo {
  uid: string;
  sid: string;
  reader: boolean;
  timeZone: string;
  email: string;
  emailVerified: boolean;
  twoFactor: boolean;
}

/**
 * The live app session for this token and its person, in one statement; null if expired, portal, disabled or
 * unknown. Like Better Auth's own session read, it pushes the expiry out to 30 days when it was last set more than
 * a day ago.
 */
export async function lookupSession(db: AnyDb, token: string): Promise<SessionInfo | null> {
  const keepFor = sql.raw(`interval '${APP_SESSION_HOURS} hours'`);
  const refreshWithin = sql.raw(`interval '${APP_SESSION_HOURS - APP_SESSION_UPDATE_HOURS} hours'`);
  const [row] = rowsOf<{ uid: string; sid: string; reader: boolean; time_zone: string | null; email: string; email_verified: boolean; two_factor_enabled: boolean | null }>(
    await db.execute(sql`
      with refreshed as (
        update session set expires_at = now() + ${keepFor}, updated_at = now()
        where token = ${token} and surface = 'app' and expires_at > now() and expires_at < now() + ${refreshWithin}
        returning id, user_id
      ), current as (
        select id, user_id from refreshed
        union all
        select id, user_id from session
        where token = ${token} and surface = 'app' and expires_at > now() and not exists (select 1 from refreshed)
      )
      select u.id as uid, c.id as sid, u.time_zone, u.email, u.email_verified, u.two_factor_enabled,
             exists(select 1 from reader_role r where r.user_id = u.id and r.revoked_at is null) as reader
      from current c join "user" u on u.id = c.user_id
      where u.disabled_at is null`)
  );
  return row
    ? { uid: row.uid, sid: row.sid, reader: Boolean(row.reader), timeZone: row.time_zone ?? "UTC", email: row.email, emailVerified: Boolean(row.email_verified), twoFactor: Boolean(row.two_factor_enabled) }
    : null;
}
