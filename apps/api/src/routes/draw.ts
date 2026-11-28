import { DrawError } from "@astro/app-core/draw/errors";
import { existingGuestHash, guestCookie, guestIdentity } from "@astro/app-core/draw/guest";
import { findToday, getReading, pick, startDraw, type Actor } from "@astro/app-core/draw/service";
import { verifyTurnstile } from "@astro/app-core/turnstile";
import { isTimeZone } from "@astro/draw";
import { z } from "zod";
import { who, type App, type C } from "../context";
import { isSecure } from "../env";
import { fail, failure, sameOrigin } from "../mutate";

const StartBody = z.object({ spread: z.enum(["one", "three"]), timeZone: z.string().max(64).optional(), turnstileToken: z.string().max(2048).optional() });
const PickBody = z.object({ sessionId: z.uuid(), stage: z.enum(["single", "majors", "minors"]), positions: z.array(z.number().int().min(0).max(77)).min(1).max(3) });

/** The person behind a read or pick: a signed-in member, or a guest with an existing guest cookie. */
async function actorOf(c: C): Promise<Actor | null> {
  const user = await who(c);
  if (user) return { kind: "user", userId: user.uid, timeZone: user.tz };
  const guestHash = await existingGuestHash(c.req.raw.headers);
  return guestHash ? { kind: "guest", guestHash, ipHash: "", timeZone: "UTC" } : null;
}

export function drawRoutes(app: App) {
  app.post("/draw/start", async (c) => {
    if (!sameOrigin(c)) return fail(c, 403, "forbidden");
    try {
      const body = StartBody.parse(await c.req.json().catch(() => null));
      const env = c.get("env");
      const user = await who(c);
      // One database function over HTTPS; the WebSocket client only until its migration has run.
      if (user) return c.json(await startDraw(c.get("db")(), { kind: "user", userId: user.uid, timeZone: user.tz }, body.spread, new Date(c.get("now")())));

      const now = new Date(c.get("now")());
      const guest = await guestIdentity(c.req.raw, env.BETTER_AUTH_SECRET, now);
      const actor: Actor = { kind: "guest", guestHash: guest.guestHash, ipHash: guest.ipHash, timeZone: body.timeZone && isTimeZone(body.timeZone) ? body.timeZone : "UTC" };
      if (guest.isNew) c.header("set-cookie", guestCookie(guest.id, isSecure(env)), { append: true });

      // A reading already under way is returned without new checks; a new one needs Turnstile and the rate limit.
      if (body.spread === "one" && !(await findToday(c.get("db")(), actor, "one", now))) {
        if (env.TURNSTILE_MODE === "on" && !(await verifyTurnstile(body.turnstileToken ?? "", env.TURNSTILE_SECRET_KEY ?? "", c.req.header("cf-connecting-ip") ?? null))) {
          return fail(c, 403, "verification_failed");
        }
        const limited = env.GUEST_DRAWS ? !(await env.GUEST_DRAWS.limit({ key: guest.ipHash })).success : false;
        if (limited) return fail(c, 429, "rate_limited");
      }
      return c.json(await startDraw(c.get("db")(), actor, body.spread, now));
    } catch (e) {
      return failure(c, e);
    }
  });

  app.post("/draw/pick", async (c) => {
    if (!sameOrigin(c)) return fail(c, 403, "forbidden");
    try {
      const body = PickBody.parse(await c.req.json().catch(() => null));
      const actor = await actorOf(c);
      if (!actor) throw new DrawError("not_found");
      return c.json(await pick(c.get("db")(), actor, body.sessionId, body.stage, body.positions));
    } catch (e) {
      return failure(c, e);
    }
  });

  app.get("/draw/:id", async (c) => {
    try {
      const actor = await actorOf(c);
      if (!actor) throw new DrawError("not_found");
      return c.json(await getReading(c.get("db")(), actor, c.req.param("id")));
    } catch (e) {
      return failure(c, e);
    }
  });
}
