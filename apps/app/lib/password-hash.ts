import { sql, type Db } from "@astro/db";

/** Marks hashes made by this scheme: bcrypt (in Postgres) over a SHA-256 of the password. */
export const HASH_PREFIX = "bcrypt-sha256$";
const BCRYPT_COST = 12;
const BCRYPT_SHAPE = /^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/;

/**
 * SHA-256, base64: 44 ASCII characters, so bcrypt's 72-byte limit never cuts a long password short.
 * Base64 has no NUL bytes, which bcrypt would treat as the end of the input.
 */
async function prehash(password: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(password)));
  return btoa(String.fromCharCode(...digest));
}

function equalTime(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Password hashing that runs bcrypt inside Postgres (pgcrypto). The Worker only waits for the database,
 * which doesn't count towards Cloudflare's CPU limit, so sign-ins fit the Workers Free plan's 10 ms.
 */
export function createPasswordHasher(db: Db) {
  const crypt = async (input: string, salt: string | null): Promise<string> => {
    const rows = await db.execute<{ h: string }>(
      salt === null ? sql`select crypt(${input}, gen_salt('bf', ${BCRYPT_COST}::int)) as h` : sql`select crypt(${input}, ${salt}) as h`
    );
    return String(rows[0]?.h ?? "");
  };

  return {
    async hash(password: string): Promise<string> {
      return HASH_PREFIX + (await crypt(await prehash(password), null));
    },
    async verify({ hash, password }: { hash: string; password: string }): Promise<boolean> {
      if (!hash.startsWith(HASH_PREFIX)) return false;
      const stored = hash.slice(HASH_PREFIX.length);
      if (!BCRYPT_SHAPE.test(stored)) return false;
      return equalTime(await crypt(await prehash(password), stored), stored);
    }
  };
}
