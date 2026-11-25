import { eq, schema } from "@astro/db";
import { isTimeZone } from "@astro/draw";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

const WEEK = 7 * 24 * 60 * 60 * 1000;

/** Changes the timezone, at most once every 7 days, so a change can't buy an extra reading. */
export const POST = mutation(z.object({ timeZone: z.string().refine(isTimeZone) }), async ({ user, body }) => {
  if (body.timeZone === user.timeZone) return json({ ok: true });
  const last = user.timeZoneChangedAt?.getTime();
  if (last && Date.now() - last < WEEK) return fail(429, "too_soon", { nextChange: new Date(last + WEEK).toISOString() });
  await getDb().update(schema.user).set({ timeZone: body.timeZone, timeZoneChangedAt: new Date() }).where(eq(schema.user.id, user.id));
  return json({ ok: true });
});
