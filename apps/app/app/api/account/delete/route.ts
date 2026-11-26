import { eq, schema } from "@astro/db";
import { z } from "zod";
import { takePasswordAttempt } from "@/lib/account";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fail, json, mutation, withCookies } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Deletes the account and everything in it. Needs the password and the typed word DELETE. */
export const POST = mutation(z.object({ password: z.string().min(1).max(128), confirm: z.literal("DELETE") }), async ({ request, user, body }) => {
  if (!(await takePasswordAttempt(getDb(), user.id))) return fail(429, "too_many_attempts");
  const auth = getAuth();
  await auth.api.verifyPassword({ body: { password: body.password }, headers: request.headers });
  const { headers } = await auth.api.signOut({ headers: request.headers, returnHeaders: true });
  await getDb().delete(schema.user).where(eq(schema.user.id, user.id));
  return withCookies(json({ ok: true }), headers);
});
