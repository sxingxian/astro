const toHex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

/** 16 random bytes as 32 lowercase hex characters. */
export function createSalt(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return toHex(bytes);
}

/** First 16 hex chars of SHA-256(order.join(",") + ":" + salt). */
export async function fingerprintOf(order: readonly string[], salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${order.join(",")}:${salt}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return toHex(new Uint8Array(digest)).slice(0, 16);
}

/** "a3f90c7e51bd92e4" → "a3f9 0c7e 51bd 92e4". */
export function formatFingerprint(fp: string): string {
  return fp.match(/.{1,4}/g)?.join(" ") ?? fp;
}

export interface Commitment {
  order: string[];
  salt: string;
  fingerprint: string;
}

export async function createCommitment(order: readonly string[]): Promise<Commitment> {
  const salt = createSalt();
  return { order: [...order], salt, fingerprint: await fingerprintOf(order, salt) };
}

export async function verifyCommitment(order: readonly string[], salt: string, fingerprint: string): Promise<boolean> {
  return (await fingerprintOf(order, salt)) === fingerprint;
}
