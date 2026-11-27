/**
 * The pass: a short-lived signed cookie that says who is signed in, so ordinary requests need no database call.
 * HMAC-SHA-256 over a JSON payload, bound to the session token (by its SHA-256), valid for five minutes. Sensitive
 * actions never rely on it: they re-check the session in the database.
 */

export const PASS_TTL_S = 300;
export const PASS_COOKIE = "astro.pass";

export interface Pass {
  uid: string;
  sid: string;
  /** SHA-256 of the session token, base64url: the pass only counts alongside that sign-in cookie. */
  th: string;
  reader: boolean;
  /** The person's timezone (their "today"); a change reaches the pass within five minutes. */
  tz: string;
  email: string;
  /** Email verified. */
  ev: boolean;
  /** Two-step on. */
  tf: boolean;
  /** Expiry, seconds since the epoch. */
  exp: number;
}

const enc = new TextEncoder();
const b64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
function fromB64url(s: string): Uint8Array<ArrayBuffer> | null {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) return null;
  try {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (s.length % 4)) % 4));
    return Uint8Array.from(bin, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

const keys = new Map<string, Promise<CryptoKey>>();
function keyFor(secret: string): Promise<CryptoKey> {
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
    keys.set(secret, k);
  }
  return k;
}

const tokenHash = async (token: string) => b64url(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token))));

/** A pass for this person, bound to their session token. */
export async function signPass(who: Omit<Pass, "th" | "exp">, sessionToken: string, secret: string, now = Date.now()): Promise<string> {
  const payload: Pass = { uid: who.uid, sid: who.sid, reader: who.reader, tz: who.tz, email: who.email, ev: who.ev, tf: who.tf, th: await tokenHash(sessionToken), exp: Math.floor(now / 1000) + PASS_TTL_S };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await keyFor(secret), enc.encode(body)));
  return `${body}.${b64url(sig)}`;
}

/** The pass if it is genuine, unexpired, well-formed and belongs to this session token; otherwise null. */
export async function readPass(cookie: string | undefined, sessionToken: string | undefined, secret: string, now = Date.now()): Promise<Pass | null> {
  if (!cookie || !sessionToken) return null;
  const [body, sig, extra] = cookie.split(".");
  if (!body || !sig || extra !== undefined) return null;
  const sigBytes = fromB64url(sig);
  if (!sigBytes) return null;
  if (!(await crypto.subtle.verify("HMAC", await keyFor(secret), sigBytes, enc.encode(body)))) return null;
  let p: Partial<Pass>;
  try {
    const raw = fromB64url(body);
    if (!raw) return null;
    p = JSON.parse(new TextDecoder().decode(raw)) as Partial<Pass>;
  } catch {
    return null;
  }
  const ok =
    typeof p.uid === "string" && p.uid !== "" && typeof p.sid === "string" && p.sid !== "" && typeof p.th === "string" && typeof p.reader === "boolean" && typeof p.tz === "string" && typeof p.email === "string" && typeof p.ev === "boolean" && typeof p.tf === "boolean" && typeof p.exp === "number";
  if (!ok) return null;
  if (p.exp! * 1000 <= now) return null;
  if (p.th !== (await tokenHash(sessionToken))) return null;
  return p as Pass;
}
