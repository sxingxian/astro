/** The data Worker's settings: `APP_URL` from wrangler.jsonc, the rest Cloudflare secrets. */
export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  PASS_SECRET: string;
  APP_URL: string;
  /**
   * Local runs only (the CPU budget check): where Neon's HTTPS driver sends queries instead of Neon. Ignored unless
   * APP_URL is a local address, so it can never redirect production queries.
   */
  NEON_FETCH_ENDPOINT?: string;
}

/** The settings if all are present and the secrets long enough; otherwise null (the caller answers 500). */
export function checkEnv(raw: Partial<Env> | undefined): Env | null {
  if (!raw) return null;
  const { DATABASE_URL, BETTER_AUTH_SECRET, PASS_SECRET, APP_URL } = raw;
  if (!DATABASE_URL?.startsWith("postgres") || !APP_URL) return null;
  if ((BETTER_AUTH_SECRET?.length ?? 0) < 32 || (PASS_SECRET?.length ?? 0) < 32) return null;
  const local = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(APP_URL);
  return { DATABASE_URL, BETTER_AUTH_SECRET: BETTER_AUTH_SECRET!, PASS_SECRET: PASS_SECRET!, APP_URL, NEON_FETCH_ENDPOINT: local ? raw.NEON_FETCH_ENDPOINT : undefined };
}
