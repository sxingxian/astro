import { acceptInvite } from "@astro/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { fail, json, mutation } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Accepts a team invitation for the signed-in person (email must match, 2-step sign-in must be on). */
export const POST = mutation(z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }), async ({ user, body }) => {
  const result = await acceptInvite(getDb(), { token: body.token, user: { id: user.id, email: user.email, twoFactorEnabled: user.twoFactorEnabled }, now: new Date() });
  return result.ok ? json({ role: result.role }) : fail(result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
});
