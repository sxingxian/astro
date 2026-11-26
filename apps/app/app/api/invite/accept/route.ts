import { acceptInvite, audit } from "@astro/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Accepts a team invitation for the signed-in person (email must match, 2-step sign-in must be on). */
export const POST = mutation(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }), async ({ request, user, body }) => {
  const result = await acceptInvite(getDb(), { token: body.token, user: { id: user.id, email: user.email, twoFactorEnabled: user.twoFactorEnabled }, now: new Date() });
  if (result.ok) {
    await audit(getDb(), { actorId: user.id, actorRole: result.role, action: "team.accept", entity: "user", entityId: user.id, summary: { role: result.role }, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
    return json({ role: result.role });
  }
  return fail(result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
});
