import { symmetricDecrypt } from "better-auth/crypto";

const PERIOD = 30;
const DIGITS = 6;
const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

async function hotp(key: Uint8Array, counter: number): Promise<string> {
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setBigUint64(0, BigInt(counter));
  const k = await crypto.subtle.importKey("raw", key as BufferSource, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", k, msg));
  const offset = (mac[mac.length - 1] as number) & 0x0f;
  const bin = (((mac[offset] as number) & 0x7f) << 24) | ((mac[offset + 1] as number) << 16) | ((mac[offset + 2] as number) << 8) | (mac[offset + 3] as number);
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * RFC 6238 TOTP check (SHA-1, 6 digits, 30-second steps), one step either side for clock drift.
 * Returns the matched time step, so callers can refuse the same code twice, or null.
 */
export async function verifyTotp(key: Uint8Array, code: string, at: Date): Promise<number | null> {
  if (!/^\d{6}$/.test(code)) return null;
  const step = Math.floor(at.getTime() / 1000 / PERIOD);
  let matched: number | null = null;
  // Check every candidate (no early exit) so timing doesn't reveal which step matched.
  for (const s of [step - 1, step, step + 1]) if (equal(await hotp(key, s), code) && matched === null) matched = s;
  return matched;
}

function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/=+$/, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = BASE32.indexOf(ch);
    if (i < 0) throw new Error("invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

/**
 * The authenticator key Better Auth stored for someone, decrypted with the shared auth secret.
 * Better Auth generates a random string and uses its UTF-8 bytes as the key; imported secrets are "base32:<secret>".
 */
export async function decryptTwoFactorKey(stored: string, authSecret: string): Promise<Uint8Array> {
  const secret = await symmetricDecrypt({ key: authSecret, data: stored });
  return secret.startsWith("base32:") ? base32Decode(secret.slice(7)) : new TextEncoder().encode(secret);
}
