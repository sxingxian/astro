import { schema, type Db } from "@astro/db";
import { isTimeZone } from "@astro/draw";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import { captcha, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import type { parseEnv } from "./env";
import type { Mail } from "./mail";
import { alreadyRegistered, resetPassword, verifyEmail } from "./mail-templates";

type AppEnv = ReturnType<typeof parseEnv>;

export interface AuthDeps {
  db: Db;
  sendMail: (mail: Mail) => Promise<void>;
  waitUntil: (p: Promise<unknown>) => void;
}

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

/** Turnstile protects the endpoints a bot would hammer. */
export const CAPTCHA_ENDPOINTS = ["/sign-up/email", "/sign-in/email", "/request-password-reset"];

/** Better Auth options for Astro. Pure, so the rules can be unit-tested without a database. */
export function authOptions(env: AppEnv, { db, sendMail, waitUntil }: AuthDeps) {
  const plugins = [
    twoFactor({ issuer: "Astro" }),
    ...(env.TURNSTILE_MODE === "on" ? [captcha({ provider: "cloudflare-turnstile", secretKey: env.TURNSTILE_SECRET_KEY ?? "", endpoints: CAPTCHA_ENDPOINTS })] : []),
    ...(env.HIBP_CHECK === "on" ? [haveIBeenPwned({ customPasswordCompromisedMessage: "This password has appeared in a data breach. Please choose a different one." })] : [])
  ];

  return {
    appName: "Astro",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.APP_URL,
    basePath: "/api/auth",
    trustedOrigins: [env.APP_URL],
    database: drizzleAdapter(db, { provider: "pg", schema: schema.authSchema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      sendResetPassword: async ({ user, url }) => sendMail(resetPassword(user.email, url)),
      onExistingUserSignUp: async ({ user }) => sendMail(alreadyRegistered(user.email, `${env.APP_URL}/sign-in`))
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendMail(verifyEmail(user.email, url))
    },
    user: {
      additionalFields: {
        timeZone: { type: "string", required: false, defaultValue: "UTC", input: true },
        timeZoneChangedAt: { type: "date", required: false, input: false },
        checkInsEnabled: { type: "boolean", required: false, defaultValue: true, input: false }
      }
    },
    disabledPaths: DISABLED_PATHS,
    hooks: {
      // Clean the timezone before Better Auth sees the body, so new and duplicate sign-ups answer identically.
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path === "/sign-up/email" && ctx.body && typeof ctx.body === "object") {
          return { context: { body: { ...(ctx.body as Record<string, unknown>), timeZone: cleanZone((ctx.body as { timeZone?: unknown }).timeZone) } } };
        }
      })
    },
    databaseHooks: {
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
    },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
    advanced: {
      cookiePrefix: "astro",
      useSecureCookies: env.APP_URL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: { handler: waitUntil }
    },
    plugins
  } satisfies BetterAuthOptions;
}
