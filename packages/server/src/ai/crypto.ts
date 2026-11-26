/** AES-256-GCM for AI service keys. The master key is a Worker secret; the row id is bound in as extra data. */

function masterKey(masterHex: string): Promise<CryptoKey> {
  if (!/^[0-9a-f]{64}$/.test(masterHex)) throw new Error("AI_KEY_ENCRYPTION_KEY must be 64 hex characters");
  const raw = Uint8Array.from(masterHex.match(/../g)!, (h) => parseInt(h, 16));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

const enc = new TextEncoder();

export async function encryptKey(masterHex: string, plaintext: string, aad: string): Promise<{ ciphertext: Uint8Array; iv: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode(aad) }, await masterKey(masterHex), enc.encode(plaintext));
  return { ciphertext: new Uint8Array(ct), iv };
}

/** Throws if the master key, the row id or the stored bytes don't match. */
export async function decryptKey(masterHex: string, box: { ciphertext: Uint8Array; iv: Uint8Array }, aad: string): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(box.iv), additionalData: enc.encode(aad) }, await masterKey(masterHex), new Uint8Array(box.ciphertext));
  return new TextDecoder().decode(pt);
}
