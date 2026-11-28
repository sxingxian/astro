// Plain checks rather than a schema library: this runs on every fresh Worker isolate's first request, and the
// schema version cost about 2 ms of Workers Free's 10 ms there.

/** The app's validated vars and secrets (bindings are added by each Worker). */
export interface AppVars {
  APP_URL: string;
  BETTER_AUTH_SECRET: string;
  EMAIL_FROM: string;
  MAIL_DRIVER: "resend" | "outbox";
  RESEND_API_KEY?: string;
  TURNSTILE_MODE: "on" | "off";
  TURNSTILE_SECRET_KEY?: string;
  PUBLIC_TURNSTILE_SITE_KEY: string;
  HIBP_CHECK: "on" | "off";
  /** The admin portal, linked after a staff invitation is accepted. */
  ADMIN_URL?: string;
  /** How long each Worker isolate trusts its last read of maintenance mode. Tests set 1. */
  MAINTENANCE_CACHE_SECONDS: number;
}

const PRODUCTION_HOST = "https://astroapp.";

const bad = (key: string): never => {
  throw new Error(`${key} is missing or invalid`);
};
const text = (raw: Record<string, unknown>, key: string, min = 0): string => {
  const v = raw[key];
  return typeof v === "string" && v.length >= min ? v : bad(key);
};
const optionalText = (raw: Record<string, unknown>, key: string): string | undefined => (raw[key] === undefined ? undefined : text(raw, key));
const url = (raw: Record<string, unknown>, key: string): string => {
  const v = text(raw, key);
  return URL.canParse(v) ? v : bad(key);
};
const oneOf = <T extends string>(raw: Record<string, unknown>, key: string, options: readonly T[]): T => {
  const v = raw[key];
  return options.includes(v as T) ? (v as T) : bad(key);
};
const seconds = (raw: Record<string, unknown>, key: string, fallback: number): number => {
  const v = raw[key];
  if (v === undefined) return fallback;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= 300 ? n : bad(key);
};

/** Validates the Worker's vars and secrets. Refuses development shortcuts on the production address. */
export function parseEnv(raw: Record<string, unknown>): AppVars {
  const env: AppVars = {
    APP_URL: url(raw, "APP_URL"),
    BETTER_AUTH_SECRET: text(raw, "BETTER_AUTH_SECRET", 32),
    EMAIL_FROM: text(raw, "EMAIL_FROM", 3),
    MAIL_DRIVER: oneOf(raw, "MAIL_DRIVER", ["resend", "outbox"] as const),
    TURNSTILE_MODE: oneOf(raw, "TURNSTILE_MODE", ["on", "off"] as const),
    PUBLIC_TURNSTILE_SITE_KEY: text(raw, "PUBLIC_TURNSTILE_SITE_KEY"),
    HIBP_CHECK: oneOf(raw, "HIBP_CHECK", ["on", "off"] as const),
    MAINTENANCE_CACHE_SECONDS: seconds(raw, "MAINTENANCE_CACHE_SECONDS", 60)
  };
  const resend = optionalText(raw, "RESEND_API_KEY");
  const turnstileSecret = optionalText(raw, "TURNSTILE_SECRET_KEY");
  const admin = raw.ADMIN_URL === undefined ? undefined : url(raw, "ADMIN_URL");
  if (resend !== undefined) env.RESEND_API_KEY = resend;
  if (turnstileSecret !== undefined) env.TURNSTILE_SECRET_KEY = turnstileSecret;
  if (admin !== undefined) env.ADMIN_URL = admin;

  if (env.APP_URL.startsWith(PRODUCTION_HOST)) {
    if (env.MAIL_DRIVER === "outbox") throw new Error("MAIL_DRIVER=outbox is not allowed in production");
    if (env.TURNSTILE_MODE === "off") throw new Error("TURNSTILE_MODE=off is not allowed in production");
    if (env.HIBP_CHECK === "off") throw new Error("HIBP_CHECK=off is not allowed in production");
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required in production");
    if (!env.TURNSTILE_SECRET_KEY) throw new Error("TURNSTILE_SECRET_KEY is required in production");
  }
  if (env.TURNSTILE_MODE === "on" && !env.TURNSTILE_SECRET_KEY) throw new Error("TURNSTILE_SECRET_KEY is required when TURNSTILE_MODE=on");
  return env;
}
