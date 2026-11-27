import type { AnyDb } from "@astro/db";
// Stage 0 only: Today's existing data functions, reused unchanged. They move to a shared package in Stage 1.
import { dueCheckIns } from "../../app/lib/check-ins";
import { findToday } from "../../app/lib/draw/service";
import { listReadings } from "../../app/lib/journal";
import { readerStatus } from "../../app/lib/readers";

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
