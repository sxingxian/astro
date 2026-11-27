import { setTimeZone, takePasswordAttempt } from "@astro/app-core/account";
import { CheckInError, NOTE_MAX as CHECK_IN_NOTE_MAX, saveCheckIn } from "@astro/app-core/check-ins";
import { JournalError, NOTE_MAX, setNote, setPrivate } from "@astro/app-core/journal";
import { and, desc, eq, schema } from "@astro/db";
import { isTimeZone } from "@astro/draw";
import QRCode from "qrcode";
import { z } from "zod";
import { authFor } from "../auth";
import { clearPass, type App, type C } from "../context";
import { fail, mutation } from "../mutate";

/**
 * Adds Better Auth's Set-Cookie headers (a replaced session) to this response. Through `c.header`, because Hono
 * replaces the Set-Cookie headers of a returned Response with the ones set on the context.
 */
function keepCookies(c: C, from?: Headers | null) {
  // Iterate rather than getSetCookie(): Better Auth's returned Headers may not have it.
  for (const [k, v] of from ?? []) if (k.toLowerCase() === "set-cookie") c.header("set-cookie", v, { append: true });
}

const journal = async (c: C, fn: () => Promise<unknown>) => {
  try {
    await fn();
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof JournalError) return fail(c, e.code === "not_found" ? 404 : 400, e.code);
    throw e;
  }
};

const CHECK_IN_STATUS = { not_found: 404, too_soon: 409, already_done: 409, too_long: 400 } as const;

/** Notes, privacy, check-ins and account settings: the same paths, bodies and answers as the Next.js routes. */
export function writeRoutes(app: App) {
  app.post(
    "/reading/:id/note",
    mutation(z.object({ body: z.string().max(NOTE_MAX + 200) }), (c, { user, body }) => journal(c, () => setNote(c.get("db")(), user.uid, c.req.param("id") ?? "", body.body)))
  );
  app.post(
    "/reading/:id/private",
    mutation(z.object({ value: z.boolean() }), (c, { user, body }) => journal(c, () => setPrivate(c.get("db")(), user.uid, c.req.param("id") ?? "", body.value)))
  );

  app.post(
    "/check-in/:id",
    mutation(z.object({ outcome: z.enum(["fit", "partly", "not", "skipped"]), note: z.string().max(CHECK_IN_NOTE_MAX + 100).optional() }), async (c, { user, body }) => {
      try {
        await saveCheckIn(c.get("db")(), user.uid, c.req.param("id") ?? "", body);
        return c.json({ ok: true });
      } catch (e) {
        if (e instanceof CheckInError) return fail(c, CHECK_IN_STATUS[e.code], e.code);
        throw e;
      }
    })
  );

  app.post(
    "/account/check-ins",
    mutation(z.object({ enabled: z.boolean() }), async (c, { user, body }) => {
      await c.get("db")().update(schema.user).set({ checkInsEnabled: body.enabled }).where(eq(schema.user.id, user.uid));
      return c.json({ ok: true });
    })
  );

  /** Changes the timezone, at most once every 7 days, so a change can't buy an extra reading. */
  app.post(
    "/account/time-zone",
    mutation(
      z.object({ timeZone: z.string().refine(isTimeZone) }),
      async (c, { user, body }) => {
        if (body.timeZone === user.tz) return c.json({ ok: true });
        const result = await setTimeZone(c.get("db")(), user.uid, body.timeZone);
        if (!result.ok) return fail(c, 429, "too_soon", { nextChange: result.nextChange });
        clearPass(c); // the pass carries the timezone
        return c.json({ ok: true });
      },
      { fresh: true }
    )
  );

  /** Signs out one of the person's other devices, by session id. Session tokens never reach the browser. */
  app.post(
    "/account/sessions/revoke",
    mutation(
      z.object({ sessionId: z.string().min(1).max(100) }),
      async (c, { user, body }) => {
        if (body.sessionId === user.sid) return fail(c, 400, "use_sign_out");
        const deleted = await c.get("db")()
          .delete(schema.session)
          .where(and(eq(schema.session.id, body.sessionId), eq(schema.session.userId, user.uid)))
          .returning({ id: schema.session.id });
        return deleted.length ? c.json({ ok: true }) : fail(c, 404, "not_found");
      },
      { fresh: true }
    )
  );

  /** Changes the password and signs out every other device. */
  app.post(
    "/account/password",
    mutation(
      z.object({ currentPassword: z.string().min(1).max(128), newPassword: z.string().min(12).max(128) }),
      async (c, { user, body }) => {
        if (!(await takePasswordAttempt(c.get("db")(), user.uid))) return fail(c, 429, "too_many_attempts");
        const { headers } = await authFor(c.get("env"), c.get("db")()).api.changePassword({ body: { ...body, revokeOtherSessions: true }, headers: c.req.raw.headers, returnHeaders: true });
        clearPass(c);
        keepCookies(c, headers);
        return c.json({ ok: true });
      },
      { fresh: true }
    )
  );

  /** Deletes the account and everything in it. Needs the password and the typed word DELETE. */
  app.post(
    "/account/delete",
    mutation(
      z.object({ password: z.string().min(1).max(128), confirm: z.literal("DELETE") }),
      async (c, { user, body }) => {
        const db = c.get("db")();
        if (!(await takePasswordAttempt(db, user.uid))) return fail(c, 429, "too_many_attempts");
        const auth = authFor(c.get("env"), db);
        await auth.api.verifyPassword({ body: { password: body.password }, headers: c.req.raw.headers });
        const { headers } = await auth.api.signOut({ headers: c.req.raw.headers, returnHeaders: true });
        await db.delete(schema.user).where(eq(schema.user.id, user.uid));
        clearPass(c);
        keepCookies(c, headers);
        return c.json({ ok: true });
      },
      { fresh: true }
    )
  );

  /** Starts 2-step setup: checks the password, returns the TOTP URI as a QR code plus the backup codes. */
  app.post(
    "/account/two-step/enable",
    mutation(
      z.object({ password: z.string().min(1).max(128) }),
      async (c, { user, body }) => {
        if (!(await takePasswordAttempt(c.get("db")(), user.uid))) return fail(c, 429, "too_many_attempts");
        const { headers, response } = await authFor(c.get("env"), c.get("db")()).api.enableTwoFactor({ body: { password: body.password }, headers: c.req.raw.headers, returnHeaders: true });
        if (response.method !== "totp") return fail(c, 500, "unexpected_method");
        const svg = await QRCode.toString(response.totpURI, { type: "svg", margin: 1, color: { dark: "#0B0B14", light: "#EDE6D6" } });
        const secret = new URL(response.totpURI).searchParams.get("secret") ?? "";
        keepCookies(c, headers);
        return c.json({ totpURI: response.totpURI, qr: `data:image/svg+xml;base64,${btoa(svg)}`, secret, backupCodes: response.backupCodes });
      },
      { fresh: true }
    )
  );

  /**
   * Turns 2-step off (password required) and signs out every other device. Other sessions are revoked first,
   * while this request's session is still the valid one (Better Auth replaces it when 2-step is disabled).
   */
  app.post(
    "/account/two-step/disable",
    mutation(
      z.object({ password: z.string().min(1).max(128) }),
      async (c, { user, body }) => {
        const db = c.get("db")();
        if (!(await takePasswordAttempt(db, user.uid))) return fail(c, 429, "too_many_attempts");
        const auth = authFor(c.get("env"), db);
        await auth.api.verifyPassword({ body: { password: body.password }, headers: c.req.raw.headers });
        await auth.api.revokeOtherSessions({ headers: c.req.raw.headers });
        const { headers } = await auth.api.disableTwoFactor({ body: { password: body.password }, headers: c.req.raw.headers, returnHeaders: true });
        clearPass(c);
        keepCookies(c, headers);
        return c.json({ ok: true });
      },
      { fresh: true }
    )
  );

  /** Published landing wording, read by the landing build. Public; 204 when nothing is published yet. */
  app.get("/copy/landing", async (c) => {
    const [row] = await c.get("db")()
      .select({ id: schema.textVersion.id, snapshot: schema.textVersion.snapshot })
      .from(schema.textVersion)
      .where(eq(schema.textVersion.kind, "landing"))
      .orderBy(desc(schema.textVersion.id))
      .limit(1);
    if (!row) return c.body(null, 204);
    return c.json({ version: row.id, overrides: row.snapshot });
  });
}
