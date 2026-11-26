import { isTimeZone } from "@astro/draw";
import { buildAuthOptions, type AuthDeps } from "@astro/server";
import type { BetterAuthOptions } from "better-auth";
import type { parseEnv } from "./env";
import { alreadyRegistered, resetPassword, verifyEmail } from "./mail-templates";

type AppEnv = Omit<ReturnType<typeof parseEnv>, "MAINTENANCE_CACHE_SECONDS">;

export type { AuthDeps } from "@astro/server";
export { CAPTCHA_ENDPOINTS } from "@astro/server";

/**
 * Better Auth endpoints the app never calls from the browser. Each is reached only through the app's own
 * routes (which revoke other sessions, rate-limit password checks and enforce the timezone rule), or not at all.
 * Server-side `auth.api` calls are unaffected: disabledPaths applies to the HTTP router only.
 */
export const DISABLED_PATHS = [
  "/update-user",
  "/change-password",
  "/change-email",
  "/delete-user",
  "/delete-user/callback",
  "/list-sessions",
  "/revoke-session",
  "/revoke-sessions",
  "/revoke-other-sessions",
  "/set-password",
  "/verify-password",
  "/list-accounts",
  "/unlink-account",
  "/link-social",
  "/account-info",
  "/refresh-token",
  "/get-access-token",
  "/send-verification-email",
  "/two-factor/enable",
  "/two-factor/disable",
  "/two-factor/get-totp-uri",
  "/two-factor/generate-backup-codes",
  "/two-factor/view-backup-codes",
  "/two-factor/send-otp",
  "/two-factor/verify-otp"
];

const cleanZone = (tz: unknown) => (typeof tz === "string" && isTimeZone(tz) ? tz : "UTC");

/** Better Auth options for the app: the shared Astro rules plus the app's own fields, hooks and closed endpoints. */
export function authOptions(env: AppEnv, deps: AuthDeps) {
  const base = buildAuthOptions(env, deps, {
    name: "app",
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    homeURL: env.APP_URL,
    cookiePrefix: "astro",
    sessionHours: 24 * 30,
    templates: { verifyEmail, resetPassword, alreadyRegistered },
    // Clean the timezone before Better Auth sees the body, so new and duplicate sign-ups answer identically.
    before: async (ctx) => {
      if (ctx.path === "/sign-up/email" && ctx.body && typeof ctx.body === "object") {
        return { context: { body: { ...(ctx.body as Record<string, unknown>), timeZone: cleanZone((ctx.body as { timeZone?: unknown }).timeZone) } } };
      }
    }
  });
  return {
    ...base,
    user: {
      additionalFields: {
        ...base.user.additionalFields,
        timeZone: { type: "string", required: false, defaultValue: "UTC", input: true },
        timeZoneChangedAt: { type: "date", required: false, input: false },
        checkInsEnabled: { type: "boolean", required: false, defaultValue: true, input: false }
      }
    },
    disabledPaths: DISABLED_PATHS,
    databaseHooks: {
      ...base.databaseHooks,
      user: {
        create: {
          before: async (user) => ({ data: { ...user, timeZone: cleanZone((user as { timeZone?: unknown }).timeZone) } })
        },
        update: {
          // The timezone changes only through /api/account/time-zone (once a week); Better Auth never writes it.
          before: async (data) => {
            const rest = { ...(data as Record<string, unknown>) };
            delete rest.timeZone;
            delete rest.timeZoneChangedAt;
            return { data: rest };
          }
        }
      }
    }
  } satisfies BetterAuthOptions;
}
