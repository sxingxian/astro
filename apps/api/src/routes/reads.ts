import { dueCheckInsQuery, dueCheckInsShape } from "@astro/app-core/check-ins";
import { liveSnapshot, PREVIEW_ID, previewSnapshot } from "@astro/app-core/copy";
import { existingGuestHash } from "@astro/app-core/draw/guest";
import { findTodayQuery, findTodayShape, getReadingQuery, getReadingShape, type Actor } from "@astro/app-core/draw/service";
import { listReadingsQuery, listReadingsShape, noteQuery } from "@astro/app-core/journal";
import { loadLegalPage } from "@astro/app-core/legal";
import { makeMaintenanceCheck, NOT_PAUSED, readMaintenanceWith, type MaintenanceState } from "@astro/app-core/maintenance";
import { computePatterns } from "@astro/app-core/patterns";
import { readerStatusQuery, readerStatusShape } from "@astro/app-core/readers";
import { desc, eq, runBatch, schema } from "@astro/db";
import { who, type App, type C } from "../context";
import { fail, failure } from "../mutate";

// The maintenance flag, read at most once per isolate per MAINTENANCE_CACHE_SECONDS (as the Next.js app does).
let maintenanceDb: Parameters<typeof readMaintenanceWith>[0] | null = null;
const isPaused = makeMaintenanceCheck<MaintenanceState>(() => readMaintenanceWith(maintenanceDb!), NOT_PAUSED);

/** Paused: every API call answers 503 with the notice, except health, the landing build's wording and auth links. */
export async function maintenance(c: C): Promise<MaintenanceState> {
  maintenanceDb = c.get("db")();
  return isPaused(c.get("env").MAINTENANCE_CACHE_SECONDS, 1500);
}

const previewOf = (c: C) => {
  const id = c.req.query("astro-preview");
  return id && PREVIEW_ID.test(id) ? id : null;
};

async function wordingFor(c: C, kind: "app" | "meanings") {
  const db = c.get("db")();
  return (await previewSnapshot(db, kind, previewOf(c))) ?? (await liveSnapshot(db, kind));
}

const signedOut = (c: C) => fail(c, 401, "signed_out");

/** The reads behind each screen: at most one database request each (a batch), or none when cached. */
export function readRoutes(app: App) {
  /** Who is signed in, the published wording (app and card meanings) and whether the app is paused. */
  app.get("/session", async (c) => {
    const [w, app, meanings, paused] = await Promise.all([who(c), wordingFor(c, "app"), wordingFor(c, "meanings"), maintenance(c)]);
    return c.json({
      user: w ? { id: w.uid, email: w.email, emailVerified: w.emailVerified, twoFactor: w.twoFactor, reader: w.reader, timeZone: w.tz } : null,
      wording: { app, meanings },
      maintenance: paused,
      preview: previewOf(c) !== null
    });
  });

  app.get("/today", async (c) => {
    const w = await who(c);
    if (!w) return signedOut(c);
    const db = c.get("db")();
    const actor: Actor = { kind: "user", userId: w.uid, timeZone: w.tz };
    const now = new Date(c.get("now")());
    const [one, three, due, recent, reader] = await runBatch(db, [
      findTodayQuery(db, actor, "one"),
      findTodayQuery(db, actor, "three"),
      dueCheckInsQuery(db, w.uid, now),
      listReadingsQuery(db, w.uid, { limit: 3 }),
      readerStatusQuery(db, w.uid)
    ] as const);
    return c.json({
      one: findTodayShape(one, now),
      three: findTodayShape(three, now),
      due: dueCheckInsShape(due),
      recent: listReadingsShape(recent, 3).items,
      reader: readerStatusShape(reader)
    });
  });

  app.get("/journal", async (c) => {
    const w = await who(c);
    if (!w) return signedOut(c);
    const f = c.req.query("filter");
    const filter = f === "one" || f === "three" ? f : "all";
    return c.json(listReadingsShape(await listReadingsQuery(c.get("db")(), w.uid, { filter, cursor: c.req.query("cursor") ?? undefined })));
  });

  app.get("/patterns", async (c) => {
    const w = await who(c);
    if (!w) return signedOut(c);
    const r = c.req.query("range");
    const range = r === "90d" || r === "all" ? r : "30d";
    return c.json(await computePatterns(c.get("db")(), w.uid, range, new Date(c.get("now")())));
  });

  /** A reading (members and guests), with the member's note. */
  app.get("/reading/:id", async (c) => {
    try {
      const w = await who(c);
      const guestHash = w ? null : await existingGuestHash(c.req.raw.headers);
      const actor: Actor | null = w ? { kind: "user", userId: w.uid, timeZone: w.tz } : guestHash ? { kind: "guest", guestHash, ipHash: "", timeZone: "UTC" } : null;
      if (!actor) return fail(c, 404, "not_found");
      const db = c.get("db")();
      const id = c.req.param("id");
      if (!w) return c.json({ reading: getReadingShape(await getReadingQuery(db, actor, id)), note: null });
      const [reading, note] = await runBatch(db, [getReadingQuery(db, actor, id), noteQuery(db, w.uid, id)] as const);
      return c.json({ reading: getReadingShape(reading), note: note[0]?.body ?? null });
    } catch (e) {
      return failure(c, e);
    }
  });

  app.get("/account", async (c) => {
    const w = await who(c);
    if (!w) return signedOut(c);
    const db = c.get("db")();
    const [user, sessions, reader] = await runBatch(db, [
      db
        .select({ name: schema.user.name, checkInsEnabled: schema.user.checkInsEnabled, timeZoneChangedAt: schema.user.timeZoneChangedAt, twoFactorEnabled: schema.user.twoFactorEnabled })
        .from(schema.user)
        .where(eq(schema.user.id, w.uid))
        .limit(1),
      db
        .select({ id: schema.session.id, userAgent: schema.session.userAgent, createdAt: schema.session.createdAt })
        .from(schema.session)
        .where(eq(schema.session.userId, w.uid))
        .orderBy(desc(schema.session.createdAt))
        .limit(20),
      readerStatusQuery(db, w.uid)
    ] as const);
    const u = user[0];
    if (!u) return signedOut(c);
    return c.json({
      user: { id: w.uid, sessionId: w.sid, email: w.email, name: u.name, timeZone: w.tz, timeZoneChangedAt: u.timeZoneChangedAt, checkInsEnabled: u.checkInsEnabled, twoFactorEnabled: Boolean(u.twoFactorEnabled) },
      sessions,
      reader: readerStatusShape(reader).reader
    });
  });

  app.get("/check-in/:id", async (c) => {
    const w = await who(c);
    if (!w) return signedOut(c);
    const due = dueCheckInsShape(await dueCheckInsQuery(c.get("db")(), w.uid, new Date(c.get("now")()), 50)).find((d) => d.sessionId === c.req.param("id"));
    return due ? c.json(due) : fail(c, 404, "not_found");
  });

  app.get("/legal/:kind", async (c) => {
    const kind = c.req.param("kind");
    if (kind !== "terms" && kind !== "privacy") return fail(c, 404, "not_found");
    return c.json(await loadLegalPage(c.get("db")(), kind, previewOf(c)));
  });
}
