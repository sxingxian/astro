import { rowsOf, sql, type AnyDb } from "@astro/db";

const COOKIE = /(?:^|;\s*)(?:__Secure-)?astro\.session_token=([^;]+)/;
const enc = new TextEncoder();
const keys = new Map<string, Promise<CryptoKey>>();
const keyFor = (secret: string) => {
  let k = keys.get(secret);
  if (!k) keys.set(secret, (k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"])));
  return k;
};

/**
 * The session token from Better Auth's sign-in cookie (`token.base64(HMAC-SHA-256(secret, token))`, URL-encoded),
 * if its signature is genuine. Accepts the `__Secure-` name production uses. Never throws.
 */
export async function sessionToken(cookieHeader: string | null | undefined, secret: string): Promise<string | null> {
  const m = cookieHeader ? COOKIE.exec(cookieHeader) : null;
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
}

/** The live app session for this token and its person, in one query; null if expired, portal, disabled or unknown. */
export async function lookupSession(db: AnyDb, token: string): Promise<SessionInfo | null> {
  const [row] = rowsOf<{ uid: string; sid: string; reader: boolean; time_zone: string | null }>(
    await db.execute(sql`
      select u.id as uid, s.id as sid, u.time_zone,
             exists(select 1 from reader_role r where r.user_id = u.id and r.revoked_at is null) as reader
      from session s join "user" u on u.id = s.user_id
      where s.token = ${token} and s.surface = 'app' and s.expires_at > now() and u.disabled_at is null`)
  );
  return row ? { uid: row.uid, sid: row.sid, reader: Boolean(row.reader), timeZone: row.time_zone ?? "UTC" } : null;
}
