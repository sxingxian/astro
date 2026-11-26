import { isTimeZone } from "@astro/draw";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { guestCookie, guestIdentity } from "@/lib/draw/guest";
import { drawFailure } from "@/lib/draw/respond";
import { findToday, startDraw, type Actor } from "@/lib/draw/service";
import { getEnv } from "@/lib/env";
import { assertSameOrigin } from "@/lib/origin";
import { verifyTurnstile } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

const Body = z.object({
  spread: z.enum(["one", "three"]),
  timeZone: z.string().max(64).optional(),
  turnstileToken: z.string().max(2048).optional()
});

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = Body.parse(await request.json().catch(() => null));
    const env = getEnv();
    const db = getDb();
    const user = await getSessionUser(request.headers);

    if (user) return Response.json(await startDraw(db, { kind: "user", userId: user.id, timeZone: user.timeZone }, body.spread));

    const now = new Date();
    const guest = await guestIdentity(request, env.BETTER_AUTH_SECRET, now);
    const actor: Actor = { kind: "guest", guestHash: guest.guestHash, ipHash: guest.ipHash, timeZone: body.timeZone && isTimeZone(body.timeZone) ? body.timeZone : "UTC" };
    const headers = new Headers();
    if (guest.isNew) headers.append("set-cookie", guestCookie(guest.id, env.APP_URL.startsWith("https://")));

    // A reading already under way is returned without new checks; a new one needs Turnstile and the rate limit.
    if (body.spread === "one" && !(await findToday(db, actor, "one", now))) {
      if (env.TURNSTILE_MODE === "on" && !(await verifyTurnstile(body.turnstileToken ?? "", env.TURNSTILE_SECRET_KEY ?? "", request.headers.get("cf-connecting-ip")))) {
        return Response.json({ error: "verification_failed" }, { status: 403, headers });
      }
      const { success } = await env.GUEST_DRAWS.limit({ key: guest.ipHash });
      if (!success) return Response.json({ error: "rate_limited" }, { status: 429, headers });
    }

    const result = await startDraw(db, actor, body.spread, now);
    return Response.json(result, { headers });
  } catch (e) {
    return drawFailure(e);
  }
}
