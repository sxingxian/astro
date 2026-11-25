import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { JournalSwitch } from "@/components/journal/JournalSwitch";
import { TabBar } from "@/components/TabBar";
import { getSessionUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { listReadings, type JournalFilter } from "@/lib/journal";

export const metadata = { title: "Journal" };

const FILTERS: { key: JournalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "one", label: "One card" },
  { key: "three", label: "Three pairs" }
];

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ filter?: string; cursor?: string }> }) {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const sp = await searchParams;
  const filter: JournalFilter = sp.filter === "one" || sp.filter === "three" ? sp.filter : "all";
  const { items, nextCursor } = await listReadings(getDb(), user.id, { filter, cursor: sp.cursor });

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-8">
      <h1 className="m-0 font-display text-4xl font-medium">Journal</h1>
      <JournalSwitch current="readings" />
      <nav aria-label="Filter readings" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <a key={f.key} href={f.key === "all" ? "/journal" : `/journal?filter=${f.key}`} aria-current={f.key === filter ? "page" : undefined} className={`flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${f.key === filter ? "border-gold bg-gold font-semibold text-night" : "border-gold/30 text-haze"}`}>{f.label}</a>
        ))}
      </nav>
      {items.length === 0 ? (
        <p className="m-0 text-haze">No readings yet. <a href="/today">Draw today's card</a> and it will appear here.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {items.map((it) => (
            <li key={it.id}>
              <a href={`/reading/${it.id}`} className="panel flex items-center gap-3.5 p-3.5 text-moon no-underline">
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="text-xs text-muted">{new Date(`${it.localDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })} · {it.spread === "one" ? "One card" : "Three pairs"}{it.private ? " · Private" : ""}</span>
                  <span className="truncate font-display text-xl leading-tight">{it.cardNames.join(" · ")}</span>
                  <span className="truncate text-xs text-muted">{it.note ? `Note: ${it.note}` : "No note"}</span>
                </div>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#8C88A6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            </li>
          ))}
        </ul>
      )}
      {nextCursor ? <a className="btn-ghost" href={`/journal?${new URLSearchParams({ ...(filter === "all" ? {} : { filter }), cursor: nextCursor })}`}>Older readings</a> : null}
      <TabBar current="/journal" />
    </div>
  );
}
