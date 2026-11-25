import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { json, mutation, withCookies } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Turns 2-step off (password required) and signs out every other device.
 * Order matters: Better Auth replaces the current session when 2-step is disabled, so the
 * other sessions are revoked first, while this request's session is still the valid one.
 */
export const POST = mutation(z.object({ password: z.string().min(1).max(128) }), async ({ request, body }) => {
  const auth = getAuth();
  await auth.api.verifyPassword({ body: { password: body.password }, headers: request.headers });
  await auth.api.revokeOtherSessions({ headers: request.headers });
  const { headers } = await auth.api.disableTwoFactor({ body: { password: body.password }, headers: request.headers, returnHeaders: true });
  return withCookies(json({ ok: true }), headers);
});
