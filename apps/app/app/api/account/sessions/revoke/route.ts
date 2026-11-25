import { and, eq, schema } from "@astro/db";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Signs out one of the person's other devices, by session id. Session tokens never reach the browser. */
export const POST = mutation(z.object({ sessionId: z.string().min(1).max(100) }), async ({ user, body }) => {
  if (body.sessionId === user.sessionId) return fail(400, "use_sign_out");
  const deleted = await getDb()
    .delete(schema.session)
    .where(and(eq(schema.session.id, body.sessionId), eq(schema.session.userId, user.id)))
    .returning({ id: schema.session.id });
  return deleted.length ? json({ ok: true }) : fail(404, "not_found");
});
