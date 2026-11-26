import { and, inArray, isNull, schema, sql } from "@astro/db";
import { alreadyRegistered, buildAuthOptions, invalidCredentials, PORTAL_ROLES, resetPassword, verifyEmail, type AuthDeps, type Role } from "@astro/server";
import type { BetterAuthOptions } from "better-auth";
import type { AdminEnvVars } from "./env";

/**
 * Endpoints the portal never offers. Staff accounts are made by invitation (part of task A5 opens sign-up
 * for a valid invite only), passwords are reset in the app, and account changes go through the portal's routes.
 */
export const ADMIN_DISABLED_PATHS = [
  "/sign-up/email",
  "/request-password-reset",
  "/reset-password",
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

/** Better Auth for the portal: shared accounts, its own 8-hour sessions and cookies, staff-only sign-in. */
export function adminAuthOptions(env: AdminEnvVars, deps: AuthDeps) {
  const base = buildAuthOptions(env, deps, {
    name: "admin",
    baseURL: new URL(env.ADMIN_URL).origin,
    basePath: `${new URL(env.ADMIN_URL).pathname.replace(/\/$/, "")}/api/auth`,
    homeURL: env.ADMIN_URL,
    cookiePrefix: "astro-admin",
    sessionHours: 8,
    templates: { verifyEmail, resetPassword, alreadyRegistered },
    // Only people with an active portal role may sign in. Everyone else gets a wrong-password answer,
    // after the same password work, so the response doesn't reveal who is staff.
    before: async (ctx) => {
      if (ctx.path !== "/sign-in/email" || !ctx.body || typeof ctx.body !== "object") return;
      const { email, password } = ctx.body as { email?: unknown; password?: unknown };
      const rows =
        typeof email === "string"
          ? await deps.db
              .select({ role: schema.staffRole.role })
              .from(schema.staffRole)
              .innerJoin(schema.user, sql`${schema.user.id} = ${schema.staffRole.userId}`)
              .where(and(sql`lower(${schema.user.email}) = lower(${email})`, isNull(schema.staffRole.revokedAt), inArray(schema.staffRole.role, PORTAL_ROLES as Role[])))
          : [];
      if (rows.length === 0) {
        await ctx.context.password.hash(typeof password === "string" ? password : "");
        throw invalidCredentials();
      }
    }
  });
  return {
    ...base,
    disabledPaths: ADMIN_DISABLED_PATHS,
    advanced: { ...base.advanced, defaultCookieAttributes: { path: "/admin", sameSite: "strict" } }
  } satisfies BetterAuthOptions;
}
