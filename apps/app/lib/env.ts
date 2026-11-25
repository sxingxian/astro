import { getCloudflareContext } from "@opennextjs/cloudflare";
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
  HIBP_CHECK: onOff
});

export type Env = z.infer<typeof schema> & { HYPERDRIVE: Hyperdrive; GUEST_DRAWS: RateLimit };

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

export function getEnv(): Env {
  const { env } = getCloudflareContext();
  const raw = env as unknown as Record<string, unknown> & { HYPERDRIVE: Hyperdrive; GUEST_DRAWS: RateLimit };
  return { ...parseEnv(raw), HYPERDRIVE: raw.HYPERDRIVE, GUEST_DRAWS: raw.GUEST_DRAWS };
}
