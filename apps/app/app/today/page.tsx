import { nextLocalMidnight } from "@astro/draw";
import { headers } from "next/headers";
import { TabBar } from "@/components/TabBar";
import { getCopy, type T } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { viewer } from "@/lib/draw/actor";
import { dueCheckIns } from "@/lib/check-ins";
import { findToday, type StartResult } from "@/lib/draw/service";

export async function generateMetadata() {
  return { title: (await getCopy())("app.today.meta") };
}

function SpreadCard({ t, title, sub, today, start, locked }: { t: T; title: string; sub: string; today: StartResult | null; start: { href: string; label: string }; locked?: { href: string; label: string } }) {
  let action = <a className="btn-gold" href={start.href}>{start.label}</a>;
  let note: string | null = null;
  if (locked) action = <a className="btn-ghost" href={locked.href}>{locked.label}</a>;
  else if (today?.status === "picking") action = <a className="btn-gold" href={start.href}>{t("app.today.continue")}</a>;
  else if (today?.status === "complete") {
    const at = nextLocalMidnight(new Date(), today.timeZone).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: today.timeZone });
    const day = nextLocalMidnight(new Date(), today.timeZone).toLocaleDateString("en-GB", { weekday: "long", timeZone: today.timeZone });
    note = t("app.today.drawn_note", { time: at, day });
    action = <a className="btn-ghost" href={`/reading/${today.sessionId}`}>{t("app.today.see_reading")}</a>;
  }
  return (
    <section className="panel flex flex-col gap-4 p-5">
      <div>
        <h2 className="m-0 font-display text-3xl font-medium">{title}</h2>
        <p className="m-0 text-sm text-muted">{sub}</p>
      </div>
      {note ? <p className="m-0 text-sm text-haze">{note}</p> : null}
      {action}
    </section>
  );
}

export default async function TodayPage() {
  const { user, actor } = await viewer(await headers());
  const db = getDb();
  const one = actor ? await findToday(db, actor, "one") : null;
  const three = user && actor ? await findToday(db, actor, "three") : null;
  const due = user ? await dueCheckIns(db, user.id) : [];
  const t = await getCopy();

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-8">
      <header className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.3" strokeLinejoin="round" /></svg>
          <span className="font-display text-2xl font-semibold">Astro</span>
        </span>
        {user ? null : <a href="/sign-up" className="text-sm">{t("app.today.sign_up")}</a>}
      </header>
      <div className="flex flex-col gap-2">
        <p className="eyebrow">{t("app.today.eyebrow")}</p>
        <h1 className="m-0 font-display text-4xl font-medium leading-tight">{t("app.today.title")}</h1>
      </div>
      {due[0] ? (
        <a href={`/check-in/${due[0].sessionId}`} className="panel flex min-h-14 items-center justify-between gap-3 px-5 py-3 text-moon no-underline">
          <span>{due.length === 1 ? t("app.today.check_in_one") : t("app.today.check_in_many", { count: String(due.length) })}<span className="block text-sm text-muted">{t("app.today.check_in_sub")}</span></span>
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#D8B46A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
      ) : null}
      <SpreadCard t={t} title={t("app.today.one_title")} sub={t("app.today.one_sub")} today={one} start={{ href: "/draw/one", label: t("app.today.one_button") }} />
      <SpreadCard
        t={t}
        title={t("app.today.three_title")}
        sub={t("app.today.three_sub")}
        today={three}
        start={{ href: "/draw/three", label: t("app.today.three_button") }}
        locked={user ? undefined : { href: "/sign-up", label: t("app.today.three_locked") }}
      />
      {user ? null : <p className="m-0 text-sm text-muted">{t("app.today.guest_note")}</p>}
      <p className="m-0 text-xs text-muted">{t("app.today.disclaimer")}</p>
      <TabBar current="/today" />
    </div>
  );
}
