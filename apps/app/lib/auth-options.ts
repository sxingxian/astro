import { schema, type Db } from "@astro/db";
import { isTimeZone } from "@astro/draw";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
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
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const tz = (user as { timeZone?: unknown }).timeZone;
            return { data: { ...user, timeZone: typeof tz === "string" && isTimeZone(tz) ? tz : "UTC" } };
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
