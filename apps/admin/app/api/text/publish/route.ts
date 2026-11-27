import { z } from "zod";
import { getDb } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { getEnv } from "@/lib/env";
import { json, mutation } from "@/lib/http";
import { stepUp } from "@/lib/step-up";
import { publish } from "@/lib/text";

export const dynamic = "force-dynamic";

const body = z.object({ kind: z.enum(["landing", "app", "meanings"]), note: z.string().max(200).default(""), code: z.string().max(6).optional() });

/** Publishes a kind's drafts. Card meanings also need a fresh authenticator code (and the owner, checked in publish). */
export const POST = mutation(body, async ({ request, user, body }) => {
  if (body.kind === "meanings") await stepUp(user, body.code ?? "");
  const result = await publish(getDb(), user, body.kind, body.note, {
    fetch,
    hookUrl: getEnv().LANDING_DEPLOY_HOOK_URL,
    now: new Date(),
    log: (entry, db) => logAudit(user, request, entry, db)
  });
  return json(result);
});
