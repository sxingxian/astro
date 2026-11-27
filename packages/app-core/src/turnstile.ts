const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/** Checks a Turnstile token with Cloudflare. Any failure, including a network error, counts as "not verified". */
export async function verifyTurnstile(token: string, secret: string, ip: string | null, fetcher: typeof fetch = fetch): Promise<boolean> {
  if (!token || token.length > 2048) return false;
  try {
    const body = new FormData();
    body.set("secret", secret);
    body.set("response", token);
    if (ip) body.set("remoteip", ip);
    const res = await fetcher(SITEVERIFY, { method: "POST", body });
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}
