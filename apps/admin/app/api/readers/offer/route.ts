import { schema, sql } from "@astro/db";
import { HttpError } from "@astro/server";
import { z } from "zod";
import { inTransaction, logAudit } from "@/lib/audit";
import { getMailer } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { json, mutation, requireCan } from "@/lib/http";
import { offerRole } from "@/lib/readers";
import { stepUp } from "@/lib/step-up";
import { emailT } from "@/lib/text";

export const dynamic = "force-dynamic";

// The account is named by id (from Users) or by its exact email (Team's "Existing account" form).
const body = z
  .object({ userId: z.string().min(1).max(64).optional(), email: z.email().max(254).optional(), reader: z.boolean(), portalRole: z.enum(["admin", "moderator"]).nullable(), code: z.string().max(6) })
  .refine((b) => (b.userId ? 1 : 0) + (b.email ? 1 : 0) === 1);

export const POST = mutation(body, async ({ request, user, body }) => {
  requireCan(user, "team.invite");
  await stepUp(user, body.code);
  const db = getDb();
  let userId = body.userId;
  if (!userId) {
    const [u] = await db.select({ id: schema.user.id }).from(schema.user).where(sql`lower(${schema.user.email}) = lower(${body.email!.trim()})`);
    if (!u) throw new HttpError(404, "not_found");
    userId = u.id;
  }
  const t = await emailT(db);
  const r = await inTransaction(async (tx) => {
    const done = await offerRole(tx, user, { userId: userId!, reader: body.reader, portalRole: body.portalRole }, new Date(), { sendMail: (m) => getMailer().send(m), appUrl: getEnv().APP_URL, emailT: t });
    await logAudit(user, request, { action: "reader.offer", entity: "user", entityId: userId, summary: { email: done.email, reader: body.reader, portalRole: body.portalRole ?? "none", expiresAt: done.expiresAt.toISOString() } }, tx);
    return done;
  });
  return json({ offerId: r.offerId, expiresAt: r.expiresAt });
});
