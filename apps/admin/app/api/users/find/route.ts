import { z } from "zod";
import { logAudit } from "@/lib/audit";
import { getDb } from "@/lib/db";
import { json, mutation, requireCan } from "@/lib/http";
import { findUser } from "@/lib/users";

export const dynamic = "force-dynamic";

/** A POST, so the email never appears in an address or a request log. Every lookup is audited. */
export const POST = mutation(z.object({ email: z.string().trim().min(3).max(254) }), async ({ request, user, body }) => {
  requireCan(user, "users.help");
  const found = await findUser(getDb(), body.email);
  await logAudit(user, request, { action: "user.find", entity: "user", entityId: found?.id, summary: { email: body.email.toLowerCase(), found: Boolean(found) } });
  return json({ user: found });
});
