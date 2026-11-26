import { can, listAudit } from "@astro/server";
import Link from "next/link";
import { LocalTime } from "@/components/audit/LocalTime";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { describe, who } from "@/lib/audit-view";
import { getDashboard, type DashboardRange } from "@/lib/dashboard";
import { getDb } from "@/lib/db";
import { pageStaff } from "@/lib/page";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const CLOUDFLARE_ANALYTICS = "https://dash.cloudflare.com/?to=/:account/workers-and-pages";
const n = (v: number) => v.toLocaleString("en-GB");

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const staff = await pageStaff("dashboard.view");
  if (!staff) return <NoAccess />;
  const range: DashboardRange = (await searchParams).range === "7d" ? "7d" : "today";
  const db = getDb();
  const [c, recent] = await Promise.all([getDashboard(db, range), can(staff.role, "audit.view") ? listAudit(db, {}, 5) : null]);
  const when = range === "today" ? "today" : "in 7 days";
  const tiles = [
    { label: `Readings ${when}`, value: n(c.readings), note: `${n(c.readingsOne)} one card · ${n(c.readingsThree)} three pairs` },
    { label: "New accounts", value: n(c.signUps), note: `${n(c.signUpsTwoStep)} turned on 2-step sign-in` },
    { label: "Active people", value: n(c.activePeople), note: "Signed in and started a reading" },
    { label: "Check-ins answered", value: n(c.checkInsAnswered), note: "Skipped check-ins aren't counted" }
  ];
  return (
    <>
      <PageHeader title="Dashboard" lede="Counts use UTC days.">
        <nav aria-label="Date range" className="flex gap-2">
          {(["today", "7d"] as const).map((r) => (
            <Link key={r} href={r === "today" ? "/" : "/?range=7d"} aria-current={range === r ? "page" : undefined} className={`btn ${range === r ? "btn-gold" : ""}`}>
              {r === "today" ? "Today" : "Last 7 days"}
            </Link>
          ))}
        </nav>
      </PageHeader>
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] max-w-[1200px]">
        {tiles.map((t) => (
          <section key={t.label} className="panel p-5 flex flex-col gap-1.5" aria-label={t.label}>
            <span className="label">{t.label}</span>
            <span className="serif text-[40px] leading-none font-semibold">{t.value}</span>
            <span className="text-[13px] text-muted">{t.note}</span>
          </section>
        ))}
      </div>
      <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(420px,100%),1fr))] max-w-[1200px] items-start">
        {recent ? (
          <section className="panel p-2" aria-labelledby="recent-h">
            <div className="flex justify-between items-center px-3 pt-3 pb-1">
              <h2 id="recent-h" className="m-0 text-base font-semibold">Recent changes</h2>
              <Link href="/audit" className="text-[13px]">Audit log</Link>
            </div>
            <ul className="m-0 p-0 list-none">
              {recent.entries.map((e) => (
                <li key={e.id} className="flex flex-wrap justify-between gap-2 px-3 py-2.5 border-t border-gold/8 text-sm">
                  <span>{describe(e).what} <span className="text-muted">· {who(e, staff.id)}</span></span>
                  <span className="text-muted text-[13px]"><LocalTime iso={e.at.toISOString()} /></span>
                </li>
              ))}
              {recent.entries.length === 0 ? <li className="px-3 py-2.5 text-sm text-muted">Nothing yet.</li> : null}
            </ul>
          </section>
        ) : null}
        <section className="panel p-5 flex flex-col gap-2" aria-labelledby="traffic-h">
          <h2 id="traffic-h" className="m-0 text-base font-semibold">Traffic and errors</h2>
          <p className="m-0 text-sm text-muted leading-relaxed">Requests, errors and response times for each Worker are in Cloudflare&apos;s dashboard, under Workers &amp; Pages.</p>
          <a className="btn self-start" href={CLOUDFLARE_ANALYTICS} target="_blank" rel="noopener noreferrer">Open Cloudflare</a>
        </section>
      </div>
    </>
  );
}
