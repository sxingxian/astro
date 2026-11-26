import { schema, type Db } from "@astro/db";
import type { BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { captcha, haveIBeenPwned, twoFactor } from "better-auth/plugins";
import type { Mail } from "./mail";
import { createPasswordHasher } from "./password-hash";

export interface BaseAuthEnv {
  BETTER_AUTH_SECRET: string;
  TURNSTILE_MODE: "on" | "off";
  TURNSTILE_SECRET_KEY?: string;
  HIBP_CHECK: "on" | "off";
}

export interface AuthDeps {
  db: Db;
  sendMail: (mail: Mail) => Promise<void>;
  waitUntil: (p: Promise<unknown>) => void;
}

export interface MailTemplates {
  verifyEmail(to: string, url: string): Mail;
  resetPassword(to: string, url: string): Mail;
  alreadyRegistered(to: string, signInUrl: string): Mail;
}

/** Where a Better Auth instance runs. The app and the admin portal share accounts but never sessions. */
export interface AuthSurface {
  name: "app" | "admin";
  /** Public URL the instance serves under, e.g. https://astro.midnightpoetry.studio/admin. */
  baseURL: string;
  basePath: string;
  cookiePrefix: string;
  sessionHours: number;
  templates: MailTemplates;
}

/** Turnstile protects the endpoints a bot would hammer. */
export const CAPTCHA_ENDPOINTS = ["/sign-up/email", "/sign-in/email", "/request-password-reset"];

/**
 * The Better Auth options every Astro surface shares: database password hashing, email rules, two-factor,
 * Turnstile, the leaked-password check, database rate limits and Cloudflare's client IP. Pure, so the rules
 * can be unit-tested without a database. Callers add their own fields, hooks and disabled paths.
 */
export function buildAuthOptions(env: BaseAuthEnv, { db, sendMail, waitUntil }: AuthDeps, surface: AuthSurface) {
  const origin = new URL(surface.baseURL).origin;
  const signIn = `${surface.baseURL}/sign-in`;
  const plugins = [
    twoFactor({ issuer: "Astro" }),
    ...(env.TURNSTILE_MODE === "on" ? [captcha({ provider: "cloudflare-turnstile", secretKey: env.TURNSTILE_SECRET_KEY ?? "", endpoints: CAPTCHA_ENDPOINTS })] : []),
    ...(env.HIBP_CHECK === "on" ? [haveIBeenPwned({ customPasswordCompromisedMessage: "This password has appeared in a data breach. Please choose a different one." })] : [])
  ];

  return {
    appName: "Astro",
    secret: env.BETTER_AUTH_SECRET,
    baseURL: surface.baseURL,
    basePath: surface.basePath,
    trustedOrigins: [origin],
    database: drizzleAdapter(db, { provider: "pg", schema: schema.authSchema }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 3600,
      // bcrypt runs in Postgres so the Worker stays under the Workers Free plan's 10 ms CPU per request.
      password: createPasswordHasher(db),
      sendResetPassword: async ({ user, url }) => sendMail(surface.templates.resetPassword(user.email, url)),
      onExistingUserSignUp: async ({ user }) => sendMail(surface.templates.alreadyRegistered(user.email, signIn))
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendMail(surface.templates.verifyEmail(user.email, url))
    },
    session: { expiresIn: surface.sessionHours * 3600, updateAge: Math.min(24, surface.sessionHours) * 3600 },
    rateLimit: { enabled: true, storage: "database", modelName: "rateLimit" },
    advanced: {
      cookiePrefix: surface.cookiePrefix,
      useSecureCookies: surface.baseURL.startsWith("https://"),
      ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] },
      backgroundTasks: { handler: waitUntil }
    },
    plugins
  } satisfies BetterAuthOptions;
}
