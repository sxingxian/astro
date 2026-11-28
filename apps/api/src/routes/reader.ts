import { loadLegalPage } from "@astro/app-core/legal";
import { deleteEntry, exportCsv, getEntry, listEntries, saveEntry } from "@astro/app-core/reader-log";
import { acceptGuidelines, pendingOffer, readerStatus } from "@astro/app-core/readers";
import { runInOrder, sql } from "@astro/db";
import { acceptInvite, acceptRoleOffer, audit, auditInsert } from "@astro/server";
import { z } from "zod";
import { clearPass, who, whoFresh, type App, type C } from "../context";
import { fail, failure, mutation } from "../mutate";

// Stage 2: the reader pages' data (Desk, My log, guidelines, giving up the role, invitations, role offers). Every
// reader action checks the role in the database itself, not the 5-minute pass, so a removed reader is refused at once.

const signedOut = (c: C) => fail(c, 401, "signed_out");
const ip = (c: C) => c.req.header("cf-connecting-ip") ?? null;
const version = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const guidelinesDoc = async (c: C) => {
  const g = await loadLegalPage(c.get("db")(), "guidelines", null, { cache: false });
  return { doc: g.doc, version: g.version };
};

/** A route whose errors (not a reader, not found, bad input) map to safe JSON answers. */
const safe = (fn: (c: C) => Promise<Response>) => async (c: C) => {
  try {
    return await fn(c);
  } catch (e) {
    return failure(c, e);
  }
};

export function readerRoutes(app: App) {
  /** Desk: readers only (others get 404, as before). Newly published guidelines come first. */
  app.get(
    "/desk",
    safe(async (c) => {
      const w = await who(c);
      if (!w) return signedOut(c);
      const s = await readerStatus(c.get("db")(), w.uid);
      if (!s.reader) return fail(c, 404, "not_found");
      return c.json({ accepted: s.accepted, guidelinesVersion: s.guidelinesVersion, guidelines: s.accepted ? null : await guidelinesDoc(c) });
    })
  );

  app.get(
    "/reader/log",
    safe(async (c) => {
      const w = await who(c);
      if (!w) return signedOut(c);
      const db = c.get("db")();
      const cursor = c.req.query("after");
      // A tampered "after" link just shows the first page.
      const page = await listEntries(db, w.uid, { cursor: cursor && cursor.length <= 200 ? cursor : null }).catch((e: unknown) => {
        if ((e as { status?: number }).status === 400) return listEntries(db, w.uid, {});
        throw e;
      });
      return c.json({ ...page, today: new Date(c.get("now")()).toLocaleDateString("en-CA", { timeZone: w.tz || "UTC" }) });
    })
  );

  /** The log as a CSV download. The audit log records only that it happened and how many rows. */
  app.get(
    "/reader/log/export",
    safe(async (c) => {
      const w = await who(c);
      if (!w) return signedOut(c);
      const db = c.get("db")();
      const { csv, rows } = await exportCsv(db, w.uid);
      await audit(db, { actorId: w.uid, actorRole: "reader", action: "reader.log_export", entity: "user", entityId: w.uid, summary: { rows }, ip: ip(c) }, c.get("env").BETTER_AUTH_SECRET);
      return c.body(csv, 200, { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="astro-reader-log.csv"', "cache-control": "no-store" });
    })
  );

  app.get(
    "/reader/log/:id",
    safe(async (c) => {
      const w = await who(c);
      if (!w) return signedOut(c);
      return c.json(await getEntry(c.get("db")(), w.uid, c.req.param("id") ?? ""));
    })
  );

  // saveEntry checks the role and validates the entry itself.
  app.post("/reader/log", mutation(z.record(z.string(), z.unknown()), async (c, { user, body }) => c.json({ id: await saveEntry(c.get("db")(), user.uid, body) })));
  app.put("/reader/log/:id", mutation(z.record(z.string(), z.unknown()), async (c, { user, body }) => c.json({ id: await saveEntry(c.get("db")(), user.uid, body, c.req.param("id") ?? "") })));
  app.delete(
    "/reader/log/:id",
    mutation(z.object({}), async (c, { user }) => {
      await deleteEntry(c.get("db")(), user.uid, c.req.param("id") ?? "");
      return c.json({ ok: true });
    })
  );

  /** A reader agrees to the newest guidelines (after they were republished). */
  app.post(
    "/reader/guidelines",
    mutation(z.object({ version }), async (c, { user, body }) => {
      await acceptGuidelines(c.get("db")(), user.uid, body.version);
      return c.json({ ok: true });
    })
  );

  /** A reader gives up their own role from Account. Their log is locked, not deleted. One transaction with its audit entry. */
  app.post(
    "/reader/give-up",
    mutation(z.object({}), async (c, { user }) => {
      const db = c.get("db")();
      if (!(await readerStatus(db, user.uid)).reader) return fail(c, 403, "not_reader");
      const entry = await auditInsert(db, { actorId: user.uid, actorRole: "reader", action: "reader.remove", entity: "user", entityId: user.uid, summary: { email: user.email }, ip: ip(c) }, c.get("env").BETTER_AUTH_SECRET);
      await runInOrder(db, [db.execute(sql`select give_up_reader_role(${user.uid})`), entry.query] as const);
      clearPass(c); // the pass carries the reader flag
      return c.json({ ok: true });
    })
  );

  /** What the invitation page needs: who is signed in and, once 2-step is on, the guidelines a reader agrees to. */
  app.get(
    "/invite",
    safe(async (c) => {
      const w = await whoFresh(c); // 2-step may have just been turned on
      if (!w) return c.json({ signedIn: false, email: null, twoFactor: false, guidelines: null, adminUrl: c.get("env").ADMIN_URL ?? null });
      return c.json({ signedIn: true, email: w.email, twoFactor: w.twoFactor, guidelines: w.twoFactor ? await guidelinesDoc(c) : null, adminUrl: c.get("env").ADMIN_URL ?? null });
    })
  );

  /**
   * Accepts a team invitation (email must match, 2-step on; readers also send the guidelines version they agreed
   * to). The role and its audit entry are saved together or not at all.
   */
  app.post(
    "/invite/accept",
    mutation(
      z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), guidelines: version.nullish() }),
      async (c, { user, body }) => {
        const result = await c.get("txDb")().transaction(async (tx) => {
          const r = await acceptInvite(tx, { token: body.token, userId: user.uid, guidelines: body.guidelines ?? -1 });
          if (r.ok) await audit(tx, { actorId: user.uid, actorRole: r.role, action: "team.accept", entity: "user", entityId: user.uid, summary: { role: r.role }, ip: ip(c) }, c.get("env").BETTER_AUTH_SECRET);
          return r;
        });
        if (!result.ok) return fail(c, result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
        clearPass(c);
        return c.json({ role: result.role });
      },
      { fresh: true }
    )
  );

  /** What the role offer page needs: the open offer for this account, if any, and the guidelines for readers. */
  app.get(
    "/offer",
    safe(async (c) => {
      const w = await whoFresh(c);
      if (!w) return c.json({ state: "signed_out" });
      const db = c.get("db")();
      const offer = await pendingOffer(db, w.uid);
      if (!offer) return c.json({ state: "none" });
      // The version comes from the same read as the document shown, so "I agree" always means this wording.
      const [status, guidelines] = await Promise.all([readerStatus(db, w.uid), offer.reader ? guidelinesDoc(c) : null]);
      return c.json({
        state: "offer",
        offer,
        email: w.email,
        timeZone: w.tz,
        twoFactor: w.twoFactor,
        guidelinesVersion: guidelines?.version ?? status.guidelinesVersion,
        guidelines,
        adminUrl: c.get("env").ADMIN_URL ?? null
      });
    })
  );

  /** Accepts a role offer made to this account. `guidelines` is the version the page showed (readers only). */
  app.post(
    "/offer/accept",
    mutation(
      z.object({ offerId: z.uuid(), guidelines: version }),
      async (c, { user, body }) => {
        const result = await c.get("txDb")().transaction(async (tx) => {
          const r = await acceptRoleOffer(tx, { offerId: body.offerId, userId: user.uid, guidelines: body.guidelines });
          if (r.ok) {
            await audit(tx, { actorId: user.uid, actorRole: r.roles.portal ?? (r.roles.reader ? "reader" : null), action: "reader.accept", entity: "role_offer", entityId: body.offerId, summary: { reader: r.roles.reader, portalRole: r.roles.portal ?? "none" }, ip: ip(c) }, c.get("env").BETTER_AUTH_SECRET);
          }
          return r;
        });
        if (!result.ok) return fail(c, result.reason === "invalid" || result.reason === "expired" ? 410 : 409, result.reason);
        clearPass(c);
        return c.json(result.roles);
      },
      { fresh: true }
    )
  );
}
