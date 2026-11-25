import { eq, schema } from "@astro/db";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ enabled: z.boolean() }), async ({ user, body }) => {
  await getDb().update(schema.user).set({ checkInsEnabled: body.enabled }).where(eq(schema.user.id, user.id));
  return json({ ok: true });
});
