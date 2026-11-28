import { audit, fail, HttpError } from "@astro/server";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { exportCsv } from "@/lib/reader-log";

export const dynamic = "force-dynamic";

/** The signed-in reader's log as a CSV download. The audit log records only that it happened and how many rows. */
export async function GET(request: Request) {
  const user = await getSessionUser(request.headers);
  if (!user) return fail(401, "signed_out");
  try {
    const db = getDb();
    const { csv, rows } = await exportCsv(db, user.id);
    await audit(db, { actorId: user.id, actorRole: "reader", action: "reader.log_export", entity: "user", entityId: user.id, summary: { rows }, ip: request.headers.get("cf-connecting-ip") }, getEnv().BETTER_AUTH_SECRET);
    return new Response(csv, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="astro-reader-log.csv"', "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.code);
    throw e;
  }
}
