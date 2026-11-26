import { z } from "zod";
import { getAuth } from "@/lib/auth";
import { json, setupMutation, withCookies } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = setupMutation(z.object({}).strict(), async ({ request }) => {
  const { headers } = await getAuth().api.signOut({ headers: request.headers, returnHeaders: true });
  return withCookies(json({ ok: true }), headers);
});
