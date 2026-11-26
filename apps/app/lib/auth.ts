import { acceptSession } from "@astro/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { betterAuth } from "better-auth";
import { cache } from "react";
import { authOptions } from "./auth-options";
import { getDb } from "./db";
import { getEnv } from "./env";
import { createMailer } from "./mail";

/** Better Auth for this request: env, database and mail come from the Worker's bindings. */
export const getAuth = cache(() => {
  const env = getEnv();
  const db = getDb();
  const mailer = createMailer({ driver: env.MAIL_DRIVER, from: env.EMAIL_FROM, apiKey: env.RESEND_API_KEY, db });
  const { ctx } = getCloudflareContext();
  return betterAuth(authOptions(env, { db, sendMail: (m) => mailer.send(m), waitUntil: (p) => ctx.waitUntil(p) }));
});

export interface SessionUser {
  id: string;
  sessionId: string;
  email: string;
  name: string;
  timeZone: string;
  timeZoneChangedAt: Date | null;
  checkInsEnabled: boolean;
  twoFactorEnabled: boolean;
}

/** The signed-in person for these request headers, or null. Portal sessions and disabled people never count. */
export async function getSessionUser(headers: Headers): Promise<SessionUser | null> {
  const result = await getAuth().api.getSession({ headers });
  if (!result) return null;
  const u = result.user as typeof result.user & { timeZone?: string; timeZoneChangedAt?: Date | null; checkInsEnabled?: boolean; twoFactorEnabled?: boolean | null; disabledAt?: Date | null };
  if (!acceptSession(result.session as { surface?: unknown }, u, "app")) return null;
  return {
    id: u.id,
    sessionId: result.session.id,
    email: u.email,
    name: u.name,
    timeZone: u.timeZone ?? "UTC",
    timeZoneChangedAt: u.timeZoneChangedAt ?? null,
    checkInsEnabled: u.checkInsEnabled ?? true,
    twoFactorEnabled: Boolean(u.twoFactorEnabled)
  };
}
