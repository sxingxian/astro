import { parseEnv, type AppVars } from "@astro/app-core/env";

/** What the data Worker is given: the app's vars and secrets, plus its own. */
export interface RawEnv extends Record<string, unknown> {
  DATABASE_URL?: string;
  PASS_SECRET?: string;
  NEON_FETCH_ENDPOINT?: string;
  NEON_WS_PROXY?: string;
  GUEST_DRAWS?: RateLimit;
  LEGACY?: Fetcher;
  ASSETS?: Fetcher;
}

export interface Env extends AppVars {
  DATABASE_URL: string;
  PASS_SECRET: string;
  /**
   * Local runs only (tests and the CPU budget check): where Neon's drivers send queries instead of Neon. Ignored
   * unless APP_URL is a local address, so they can never redirect production queries.
   */
  NEON_FETCH_ENDPOINT?: string;
  NEON_WS_PROXY?: string;
  GUEST_DRAWS?: RateLimit;
  LEGACY?: Fetcher;
}

const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const parsed = new WeakMap<object, Env | null>();

/** The settings if all are present and valid; otherwise null (the caller answers 500 without saying which). */
export function checkEnv(raw: RawEnv | undefined): Env | null {
  if (!raw) return null;
  if (parsed.has(raw)) return parsed.get(raw)!;
  let env: Env | null = null;
  try {
    const app = parseEnv(raw);
    const { DATABASE_URL, PASS_SECRET } = raw;
    if (DATABASE_URL?.startsWith("postgres") && (PASS_SECRET?.length ?? 0) >= 32) {
      const local = LOCAL.test(app.APP_URL);
      env = {
        ...app,
        DATABASE_URL,
        PASS_SECRET: PASS_SECRET!,
        NEON_FETCH_ENDPOINT: local ? raw.NEON_FETCH_ENDPOINT : undefined,
        NEON_WS_PROXY: local ? raw.NEON_WS_PROXY : undefined,
        GUEST_DRAWS: raw.GUEST_DRAWS,
        LEGACY: raw.LEGACY
      };
    }
  } catch {
    env = null;
  }
  parsed.set(raw, env);
  return env;
}

export const isSecure = (env: Env) => env.APP_URL.startsWith("https://");
