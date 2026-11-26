import { z } from "zod";
import { getDb } from "@/lib/db";
import { json, mutation, requireCan } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { removeRole } from "@/lib/team";

export const dynamic = "force-dynamic";

export const POST = mutation(z.object({ userId: z.string().min(1).max(64), code: z.string().max(6) }), async ({ user, body }) => {
  requireCan(user, "team.manage");
  await stepUp(user, body.code);
  return json(await removeRole(getDb(), user, body.userId));
});
