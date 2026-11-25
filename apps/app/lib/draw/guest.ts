export const GUEST_COOKIE = "astro_guest";
const TTL_SECONDS = 48 * 3600;

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s: string) => hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message)));
}

function readCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return v.join("=");
  }
  return null;
}

export interface GuestIdentity {
  id: string;
  isNew: boolean;
  /** SHA-256 of the cookie value; the raw id is never stored. */
  guestHash: string;
  /** SHA-256 of the IP and a salt that changes every UTC day; the IP is never stored. */
  ipHash: string;
}

/** The guest behind a request: their cookie (or a new one) and a privacy-preserving network hash. */
export async function guestIdentity(request: Request, secret: string, now: Date = new Date()): Promise<GuestIdentity> {
  const raw = readCookie(request, GUEST_COOKIE);
  const valid = raw && /^[0-9a-f]{32}$/.test(raw);
  let id = valid ? raw : "";
  if (!id) {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    id = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  const daySalt = await hmac(secret, `guest-ip:${now.toISOString().slice(0, 10)}`);
  return { id, isNew: !valid, guestHash: await sha256(`guest:${id}`), ipHash: await sha256(`${ip}:${daySalt}`) };
}

/** Only the hash of an existing cookie, for reads and picks (never mints a new guest). */
export async function existingGuestHash(request: Request): Promise<string | null> {
  const raw = readCookie(request, GUEST_COOKIE);
  return raw && /^[0-9a-f]{32}$/.test(raw) ? sha256(`guest:${raw}`) : null;
}

export function guestCookie(id: string, secure: boolean): string {
  return `${GUEST_COOKIE}=${id}; Path=/; Max-Age=${TTL_SECONDS}; HttpOnly${secure ? "; Secure" : ""}; SameSite=Lax`;
}
