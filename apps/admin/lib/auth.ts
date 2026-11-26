import { and, eq, isNull, schema } from "@astro/db";
import { acceptSession, createMailer, PORTAL_ROLES, type Role } from "@astro/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { cache } from "react";
import { adminAuthOptions } from "./auth-options";
import { getDb } from "./db";
import { getEnv } from "./env";

export const getMailer = cache(() => {
  const env = getEnv();
  return createMailer({ driver: env.MAIL_DRIVER, from: env.EMAIL_FROM, apiKey: env.RESEND_API_KEY, db: getDb() });
});

/** Better Auth for this request. */
export const getAuth = cache(() => {
  const { ctx } = getCloudflareContext();
  return betterAuth(adminAuthOptions(getEnv(), { db: getDb(), sendMail: (m) => getMailer().send(m), waitUntil: (p) => ctx.waitUntil(p) }));
});

export interface Staff {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  role: Role;
  twoFactorEnabled: boolean;
}

/**
 * The signed-in staff member, or null: a portal session (never an app one), a person who isn't disabled,
 * and an active owner, admin or moderator role. Callers decide what to do when 2-step sign-in is still off.
 */
export const getStaff = cache(async (headers: Headers): Promise<Staff | null> => {
  const result = await getAuth().api.getSession({ headers });
  if (!result) return null;
  const u = result.user as typeof result.user & { twoFactorEnabled?: boolean | null; disabledAt?: Date | null };
  if (!acceptSession(result.session as { surface?: unknown }, u, "admin")) return null;
  const [row] = await getDb()
    .select({ role: schema.staffRole.role })
    .from(schema.staffRole)
    .where(and(eq(schema.staffRole.userId, u.id), isNull(schema.staffRole.revokedAt)));
  if (!row || !PORTAL_ROLES.includes(row.role)) return null;
  return { id: u.id, sessionId: result.session.id, email: u.email, name: u.name, role: row.role, twoFactorEnabled: Boolean(u.twoFactorEnabled) };
});
