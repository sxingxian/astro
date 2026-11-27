import { z } from "zod";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { json, mutation } from "@/lib/http";
import { rebuildAgain } from "@/lib/text";

export const dynamic = "force-dynamic";

/** Starts the landing rebuild again for the live version (same 2-minute limit as publishing). */
export const POST = mutation(z.object({}), async ({ request, user }) =>
  json(await rebuildAgain(getDb(), user, { fetch, hookUrl: getEnv().LANDING_DEPLOY_HOOK_URL, now: new Date(), log: (entry, db) => logAudit(user, request, entry, db) }))
);
