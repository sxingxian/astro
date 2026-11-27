/** The data Worker's settings: `APP_URL` from wrangler.jsonc, the rest Cloudflare secrets. */
export interface Env {
  DATABASE_URL: string;
  BETTER_AUTH_SECRET: string;
  PASS_SECRET: string;
  APP_URL: string;
}

/** The settings if all are present and the secrets long enough; otherwise null (the caller answers 500). */
export function checkEnv(raw: Partial<Env> | undefined): Env | null {
  if (!raw) return null;
  const { DATABASE_URL, BETTER_AUTH_SECRET, PASS_SECRET, APP_URL } = raw;
  if (!DATABASE_URL?.startsWith("postgres") || !APP_URL) return null;
  if ((BETTER_AUTH_SECRET?.length ?? 0) < 32 || (PASS_SECRET?.length ?? 0) < 32) return null;
  return { DATABASE_URL, BETTER_AUTH_SECRET: BETTER_AUTH_SECRET!, PASS_SECRET: PASS_SECRET!, APP_URL };
}
