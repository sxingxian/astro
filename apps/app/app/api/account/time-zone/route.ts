import { isTimeZone } from "@astro/draw";
import { z } from "zod";
import { setTimeZone } from "@/lib/account";
import { getDb } from "@/lib/db";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Changes the timezone, at most once every 7 days, so a change can't buy an extra reading. */
export const POST = mutation(z.object({ timeZone: z.string().refine(isTimeZone) }), async ({ user, body }) => {
  if (body.timeZone === user.timeZone) return json({ ok: true });
  const result = await setTimeZone(getDb(), user.id, body.timeZone);
  return result.ok ? json({ ok: true }) : fail(429, "too_soon", { nextChange: result.nextChange });
});
