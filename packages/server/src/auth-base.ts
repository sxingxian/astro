import { eq, schema, sql, type Db } from "@astro/db";
import { APIError, BASE_ERROR_CODES, type BetterAuthOptions } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
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
  verifyEmail(to: string, url: string): Mail | Promise<Mail>;
  resetPassword(to: string, url: string): Mail | Promise<Mail>;
  alreadyRegistered(to: string, signInUrl: string): Mail | Promise<Mail>;
}

/** Where a Better Auth instance runs. The app and the admin portal share accounts but never sessions. */
export interface AuthSurface {
  name: "app" | "admin";
  /** Origin the instance serves on, e.g. https://astro.midnightpoetry.studio. */
  baseURL: string;
  /** The full path of the auth endpoints. Better Auth matches requests on this alone, so include any app prefix. */
  basePath: string;
  /** Where people land; email links to sign-in point here, e.g. https://astro.midnightpoetry.studio/admin. */
  homeURL: string;
  cookiePrefix: string;
  sessionHours: number;
  templates: MailTemplates;
  /**
   * Runs before Better Auth handles a request, after the shared disabled-account check. Return `{ context }`
   * to rewrite the request (as Better Auth's `hooks.before` does), throw an APIError to refuse it.
   */
  before?: (ctx: AuthMiddlewareContext) => Promise<{ context: Record<string, unknown> } | void>;
}

type AuthMiddlewareContext = Parameters<Parameters<typeof createAuthMiddleware>[0]>[0];

/** True only for a session made on `surface`, belonging to someone who isn't disabled. */
export function acceptSession(session: { surface?: unknown }, user: { disabledAt?: unknown }, surface: AuthSurface["name"]): boolean {
  return session.surface === surface && !user.disabledAt;
}

/** The response Better Auth gives for a wrong password, so a refused sign-in looks exactly the same. */
export const invalidCredentials = () => APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD);

async function isDisabled(db: Db, email: string): Promise<boolean> {
  const rows = await db.select({ disabledAt: schema.user.disabledAt }).from(schema.user).where(sql`lower(${schema.user.email}) = lower(${email})`);
  return Boolean(rows[0]?.disabledAt);
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
  const signIn = `${surface.homeURL}/sign-in`;
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
      sendResetPassword: async ({ user, url }) => sendMail(await surface.templates.resetPassword(user.email, url)),
      onExistingUserSignUp: async ({ user }) => sendMail(await surface.templates.alreadyRegistered(user.email, signIn))
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      autoSignInAfterVerification: true,
      expiresIn: 3600,
      sendVerificationEmail: async ({ user, url }) => sendMail(await surface.templates.verifyEmail(user.email, url))
    },
    session: {
      expiresIn: surface.sessionHours * 3600,
      updateAge: Math.min(24, surface.sessionHours) * 3600,
      additionalFields: { surface: { type: "string", required: false, input: false, defaultValue: surface.name } }
    },
    user: {
      additionalFields: { disabledAt: { type: "date", required: false, input: false } }
    },
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        // A disabled person gets the same answer as a wrong password, after the same password work.
        if (ctx.path === "/sign-in/email" && ctx.body && typeof ctx.body === "object") {
          const { email, password } = ctx.body as { email?: unknown; password?: unknown };
          if (typeof email === "string" && (await isDisabled(db, email))) {
            await ctx.context.password.hash(typeof password === "string" ? password : "");
            throw invalidCredentials();
          }
        }
        return surface.before?.(ctx);
      })
    },
    databaseHooks: {
      session: {
        create: {
          // Every session records its surface, and none is ever made for a disabled person.
          before: async (session) => {
            const [u] = await db.select({ disabledAt: schema.user.disabledAt }).from(schema.user).where(eq(schema.user.id, session.userId));
            if (!u || u.disabledAt) return false;
            return { data: { ...session, surface: surface.name } };
          }
        }
      }
    },
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
