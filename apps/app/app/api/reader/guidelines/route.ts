import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation } from "@/lib/http";
import { acceptGuidelines } from "@/lib/readers";

export const dynamic = "force-dynamic";

/** A reader agrees to the newest reader guidelines (after they were republished). */
export const POST = mutation(z.object({ version: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER) }), async ({ user, body }) => {
  await acceptGuidelines(getDb(), user.id, body.version);
  return json({ ok: true });
});
