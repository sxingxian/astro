import { listAudit } from "@astro/server";
import { logAudit } from "@/lib/audit";
import { describe, parseAuditQuery } from "@/lib/audit-view";
import { getStaff } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { fail, HttpError, requireCan } from "@/lib/http";

export const dynamic = "force-dynamic";

const MAX_ROWS = 10_000;

/** Quotes a CSV cell, and defuses anything a spreadsheet would run as a formula. */
function cell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replaceAll('"', '""')}"`;
}

/** The filtered log as CSV, at most 10,000 rows. Session cookies are SameSite=Strict, so other sites can't trigger it. */
export async function GET(request: Request): Promise<Response> {
  try {
    const staff = await getStaff(request.headers);
    if (!staff?.twoFactorEnabled) return fail(401, "signed_out");
    requireCan(staff, "audit.view");
    const { filter } = parseAuditQuery(Object.fromEntries(new URL(request.url).searchParams));
    const { entries } = await listAudit(getDb(), { ...filter, cursor: undefined }, MAX_ROWS);
    const lines = [["When (UTC)", "Person", "Role", "Action", "What", "Details", "Entity", "Entity id"].map(cell).join(",")];
    for (const e of entries) {
      const d = describe(e);
      lines.push([e.at.toISOString(), e.actorEmail, e.actorRole, e.action, d.what, d.details, e.entity, e.entityId].map(cell).join(","));
    }
    await logAudit(staff, request, { action: "audit.export", entity: "audit_log", summary: { rows: entries.length } });
    return new Response(lines.join("\r\n") + "\r\n", {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="astro-audit-${new Date().toISOString().slice(0, 10)}.csv"` }
    });
  } catch (e) {
    if (e instanceof HttpError) return fail(e.status, e.code);
    console.error("audit export failed", e instanceof Error ? e.message : e);
    return fail(500, "server_error");
  }
}
