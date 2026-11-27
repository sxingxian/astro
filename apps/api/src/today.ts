import { dueCheckIns } from "@astro/app-core/check-ins";
import { findToday } from "@astro/app-core/draw/service";
import { listReadings } from "@astro/app-core/journal";
import { readerStatus } from "@astro/app-core/readers";
import type { AnyDb } from "@astro/db";

/** What the Today screen shows for a signed-in person (the same calls the Today page makes now). */
export async function todayFor(db: AnyDb, uid: string, timeZone: string) {
  const actor = { kind: "user" as const, userId: uid, timeZone };
  const [one, three, due, recent, reader] = await Promise.all([
    findToday(db, actor, "one"),
    findToday(db, actor, "three"),
    dueCheckIns(db, uid),
    listReadings(db, uid, { limit: 3 }).then((r) => r.items),
    readerStatus(db, uid)
  ]);
  return { one, three, due, recent, reader };
}
