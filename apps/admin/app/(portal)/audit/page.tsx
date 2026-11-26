import { listAudit } from "@astro/server";
import { sql } from "@astro/db";
import Link from "next/link";
import { AuditFilters } from "@/components/audit/AuditFilters";
import { LocalTime } from "@/components/audit/LocalTime";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { describe, parseAuditQuery, queryString, who } from "@/lib/audit-view";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const staff = await pageStaff("audit.view");
  if (!staff) return <NoAccess />;
  const { query, filter } = parseAuditQuery(await searchParams);
  const db = getDb();
  const [{ entries, nextCursor }, people] = await Promise.all([
    listAudit(db, filter),
    db.execute<{ id: string; email: string }>(sql`select distinct u.id, u.email from audit_log a join "user" u on u.id = a.actor_id order by u.email limit 200`)
  ]);
  return (
    <>
      <PageHeader title="Audit log" lede="Everything done in the portal. Entries can't be edited or deleted, and never contain keys or passwords." />
      <AuditFilters query={query} people={people.map((p) => ({ id: p.id, email: p.email }))} />
      <section className="panel p-2" aria-label="Audit entries">
        <div className="overflow-x-auto">
          <table className="grid min-w-[760px]">
            <thead><tr><th scope="col">When</th><th scope="col">Who</th><th scope="col">What</th><th scope="col">Details</th></tr></thead>
            <tbody>
              {entries.map((e) => {
                const d = describe(e);
                return (
                  <tr key={e.id}>
                    <td className="whitespace-nowrap"><LocalTime iso={e.at.toISOString()} /></td>
                    <td>{who(e, staff.id)}</td>
                    <td>{d.what}</td>
                    <td className="text-muted">{d.details}</td>
                  </tr>
                );
              })}
              {entries.length === 0 ? <tr><td colSpan={4} className="text-muted">Nothing matches these filters.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          Showing {entries.length} {entries.length === 1 ? "entry" : "entries"}
          {nextCursor ? <> · <Link href={`/audit${queryString(query, { cursor: String(nextCursor) })}`}>Older entries</Link></> : null}
        </span>
        <a className="btn" href={`/admin/api/audit/export${queryString(query)}`} download>Download as CSV</a>
      </div>
    </>
  );
}
