import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";

const onOff = z.enum(["on", "off"]);

const schema = z.object({
  ADMIN_URL: z.url(),
  APP_URL: z.url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  EMAIL_FROM: z.string().min(3),
  MAIL_DRIVER: z.enum(["resend", "outbox"]),
  RESEND_API_KEY: z.string().optional(),
  TURNSTILE_MODE: onOff,
  TURNSTILE_SECRET_KEY: z.string().optional(),
  PUBLIC_TURNSTILE_SITE_KEY: z.string(),
  HIBP_CHECK: onOff,
  /** Encrypts AI service keys (AES-256-GCM). 32 bytes as 64 hex characters. */
  AI_KEY_ENCRYPTION_KEY: z.string().regex(/^[0-9a-f]{64}$/, "AI_KEY_ENCRYPTION_KEY must be 64 hex characters"),
  AI_GATEWAY_URL: z.url(),
  /** The landing page's Workers Builds Deploy Hook. Publishing landing text calls it. The URL is the credential. */
  LANDING_DEPLOY_HOOK_URL: z.url().optional(),
  OWNER_ALERTS: onOff.default("on")
});

export type AdminEnvVars = z.infer<typeof schema>;
export type Env = AdminEnvVars & { HYPERDRIVE: Hyperdrive };

const PRODUCTION_HOST = "https://astro.midnightpoetry.studio";

/** Validates the portal's vars and secrets. Refuses development shortcuts on the production address. */
export function parseEnv(raw: Record<string, unknown>): AdminEnvVars {
  const env = schema.parse(raw);
  if (env.ADMIN_URL.startsWith(PRODUCTION_HOST)) {
    if (env.MAIL_DRIVER === "outbox") throw new Error("MAIL_DRIVER=outbox is not allowed in production");
    if (env.TURNSTILE_MODE === "off") throw new Error("TURNSTILE_MODE=off is not allowed in production");
    if (env.HIBP_CHECK === "off") throw new Error("HIBP_CHECK=off is not allowed in production");
    if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY is required in production");
    if (!env.TURNSTILE_SECRET_KEY) throw new Error("TURNSTILE_SECRET_KEY is required in production");
    if (!env.AI_GATEWAY_URL.startsWith("https://")) throw new Error("AI_GATEWAY_URL must be https in production");
    if (!env.LANDING_DEPLOY_HOOK_URL?.startsWith("https://")) throw new Error("LANDING_DEPLOY_HOOK_URL is required in production");
  }
  if (env.TURNSTILE_MODE === "on" && !env.TURNSTILE_SECRET_KEY) throw new Error("TURNSTILE_SECRET_KEY is required when TURNSTILE_MODE=on");
  return env;
}

export function getEnv(): Env {
  const { env } = getCloudflareContext();
  const raw = env as unknown as Record<string, unknown> & { HYPERDRIVE: Hyperdrive };
  return { ...parseEnv(raw), HYPERDRIVE: raw.HYPERDRIVE };
}
