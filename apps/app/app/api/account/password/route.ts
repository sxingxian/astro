import { z } from "zod";
import { takePasswordAttempt } from "@/lib/account";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fail, json, mutation, withCookies } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Changes the password and signs out every other device. */
export const POST = mutation(z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }), async ({ request, user, body }) => {
  if (!(await takePasswordAttempt(getDb(), user.id))) return fail(429, "too_many_attempts");
  const { headers } = await getAuth().api.changePassword({ body: { ...body, revokeOtherSessions: true }, headers: request.headers, returnHeaders: true });
  return withCookies(json({ ok: true }), headers);
});
