import type { Db } from "@astro/db";
import { audit } from "@astro/server";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { fail, json, mutation } from "@/lib/http";
import { giveUpReaderRole, readerStatus } from "@/lib/readers";

export const dynamic = "force-dynamic";

/** A reader gives up their own role from Account. Their log is locked, not deleted. */
export const POST = mutation(z.object({}), async ({ request, user }) => {
  const db = getDb();
  if (!(await readerStatus(db, user.id)).reader) return fail(403, "not_reader");
  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    await giveUpReaderRole(tx, user.id);
    await audit(tx, { actorId: user.id, actorRole: "reader", action: "reader.remove", entity: "user", entityId: user.id, summary: { email: user.email }, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
  });
  return json({ ok: true });
});
