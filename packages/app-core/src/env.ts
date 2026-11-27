import { z } from "zod";

const onOff = z.enum(["on", "off"]);

const schema = z.object({
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  EMAIL_FROM: z.string().min(3),
  MAIL_DRIVER: z.enum(["resend", "outbox"]),
  RESEND_API_KEY: z.string().optional(),
  TURNSTILE_MODE: onOff,
  TURNSTILE_SECRET_KEY: z.string().optional(),
  PUBLIC_TURNSTILE_SITE_KEY: z.string(),
  HIBP_CHECK: onOff,
  /** The admin portal, linked after a staff invitation is accepted. */
  ADMIN_URL: z.url().optional(),
  /** How long each Worker isolate trusts its last read of maintenance mode. Tests set 1. */
  MAINTENANCE_CACHE_SECONDS: z.coerce.number().int().min(0).max(300).default(60)
});

/** The app's validated vars and secrets (bindings are added by each Worker). */
export type AppVars = z.infer<typeof schema>;

const PRODUCTION_HOST = "https://astroapp.";

/** Validates the Worker's vars and secrets. Refuses development shortcuts on the production address. */
export function parseEnv(raw: Record<string, unknown>): z.infer<typeof schema> {
  const env = schema.parse(raw);
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
