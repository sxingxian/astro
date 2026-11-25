import { z } from "zod";
import { CheckInError, NOTE_MAX, saveCheckIn } from "@/lib/check-ins";
import { getDb } from "@/lib/db";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

const STATUS = { not_found: 404, too_soon: 409, already_done: 409, too_long: 400 } as const;

export const POST = mutation(z.object({ outcome: z.enum(["fit", "partly", "not", "skipped"]), note: z.string().max(NOTE_MAX + 100).optional() }), async ({ request, user, body }) => {
  const id = new URL(request.url).pathname.split("/").at(-1) ?? "";
  try {
    await saveCheckIn(getDb(), user.id, id, body);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof CheckInError) return fail(STATUS[e.code], e.code);
    throw e;
  }
});
