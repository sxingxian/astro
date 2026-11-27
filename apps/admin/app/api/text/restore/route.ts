import { z } from "zod";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { json, mutation } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { restore } from "@/lib/text";

export const dynamic = "force-dynamic";

const body = z.object({ versionId: z.number().int().positive(), code: z.string().max(6) });

/** Publishes an older version again. Needs a fresh authenticator code. */
export const POST = mutation(body, async ({ request, user, body }) => {
  await stepUp(user, body.code);
  const result = await restore(getDb(), user, body.versionId, {
    fetch,
    hookUrl: getEnv().LANDING_DEPLOY_HOOK_URL,
    now: new Date(),
    log: (entry, db) => logAudit(user, request, entry, db)
  });
  return json(result);
});
