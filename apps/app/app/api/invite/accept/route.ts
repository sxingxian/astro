import type { Db } from "@astro/db";
import { acceptInvite, audit } from "@astro/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Accepts a team invitation for the signed-in person (email must match, 2-step sign-in must be on). */
export const POST = mutation(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }), async ({ request, user, body }) => {
  // The role and its audit entry are saved together or not at all.
  const result = await getDb().transaction(async (t) => {
    const tx = t as unknown as Db;
    const r = await acceptInvite(tx, { token: body.token, userId: user.id });
    if (r.ok) await audit(tx, { actorId: user.id, actorRole: r.role, action: "team.accept", entity: "user", entityId: user.id, summary: { role: r.role }, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
    return r;
  });
  return result.ok ? json({ role: result.role }) : fail(result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
});
