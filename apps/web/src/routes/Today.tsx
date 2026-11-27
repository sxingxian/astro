import { nextLocalMidnight } from "@astro/draw";
import { CardBack } from "@astro/ui";
import type { ReactNode } from "react";
import { Greeting } from "@/components/today/Greeting";
import type { DueCheckIn } from "@/lib/check-ins";
import type { StartResult } from "@/lib/draw/service";
import { localGreeting } from "@/lib/greeting";
import type { JournalItem } from "@/lib/journal";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle, type T } from "../session";
import { AppShell } from "../shell/AppShell";

interface TodayData {
  signedIn: boolean;
  one: StartResult | null;
  three: StartResult | null;
  due: (Omit<DueCheckIn, "completedAt"> & { completedAt: string })[];
  recent: JournalItem[];
}

// Ported from apps/app/app/today/page.tsx (same markup); data from GET /api/today.
const shortDay = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

/** Small card backs: one for Today's card, three for Three pairs (mockups D1 and phone Today). */
function SpreadArt({ count }: { count: 1 | 3 }) {
  return (
    <span aria-hidden="true" className="flex flex-none gap-1.5">
      {Array.from({ length: count }, (_, i) => (
        <span key={i} className={`block overflow-hidden rounded-md [&_.card-back]:size-full ${count === 1 ? "h-[68px] w-[42px] lg:h-[92px] lg:w-14" : "h-[58px] w-[22px] lg:h-[60px] lg:w-[34px]"}`}>
          <CardBack />
        </span>
      ))}
    </span>
  );
}

function SpreadCard({ t, count, title, sub, today, start, locked }: { t: T; count: 1 | 3; title: string; sub: string; today: StartResult | null; start: { href: string; label: string }; locked?: { href: string; label: string } }) {
  let action: ReactNode = (
    <a className="btn-gold min-h-11 px-5 lg:self-start" href={start.href}>
      <span className="lg:hidden">{t("app.today.draw_short")}</span>
      <span className="hidden lg:inline">{start.label}</span>
    </a>
  );
  let status = sub;
  if (locked) action = <a className="btn-ghost min-h-11 px-4 text-sm max-lg:basis-full lg:self-start" href={locked.href}>{locked.label}</a>;
  else if (today?.status === "picking") action = <a className="btn-gold min-h-11 px-5 lg:self-start" href={start.href}>{t("app.today.continue")}</a>;
  else if (today?.status === "complete") {
    const next = nextLocalMidnight(new Date(), today.timeZone);
    status = t("app.today.drawn_note", {
      time: next.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: today.timeZone }),
      day: next.toLocaleDateString("en-GB", { weekday: "long", timeZone: today.timeZone })
    });
    action = <a className="btn-ghost min-h-11 px-4 text-sm lg:self-start" href={`/reading/${today.sessionId}`}>{t("app.today.see_reading")}</a>;
  }
  return (
    <section className={`panel flex flex-wrap items-center gap-4 p-4 lg:flex-nowrap lg:flex-col lg:items-stretch lg:gap-5 lg:p-6 ${locked ? "border-dashed" : ""}`}>
      <SpreadArt count={count} />
      <div className="min-w-0 flex-1">
        <h2 className="m-0 font-display text-[26px] font-medium leading-tight lg:text-3xl">{title}</h2>
        <p className="m-0 text-sm text-muted">{status}</p>
      </div>
      {action}
    </section>
  );
}

export default function TodayPage() {
  const { t, user } = useSession();
  useTitle(t("app.today.meta"));
  const { data, error } = useData<TodayData>("/api/today");
  if (error) return <AppShell current="today"><Failed error={error} /></AppShell>;
  if (!data) return <AppShell current="today"><Loading /></AppShell>;
  const { one, three, recent } = data;
  const due = data.due.map((d) => ({ ...d, completedAt: new Date(d.completedAt) }));
  const zone = user?.timeZone ?? null;
  const footer = (
    <p className="m-0 text-xs text-muted">
      {t("app.today.disclaimer")} <a href="/terms">{t("app.today.terms")}</a> · <a href="/privacy">{t("app.today.privacy")}</a>
    </p>
  );

  return (
    <AppShell current="today">
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-4 lg:max-w-none lg:gap-6 lg:px-0 lg:pb-16 lg:pt-4">
        <header className="flex min-h-12 items-center justify-between lg:hidden">
          <span className="flex items-center gap-2.5">
            <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.3" strokeLinejoin="round" /></svg>
            <span className="font-display text-2xl font-semibold">Astro</span>
          </span>
          {user ? null : <a href="/sign-up" className="btn-ghost min-h-10 px-4 text-sm">{t("app.today.sign_up")}</a>}
        </header>

        <div className="flex flex-col gap-1 lg:flex-row lg:items-end lg:justify-between lg:gap-6">
          <Greeting timeZone={zone} initial={localGreeting(zone ?? "UTC")} />
          {zone ? <p className="m-0 hidden text-sm text-muted lg:block">{t("app.today.resets", { zone })}</p> : null}
        </div>
        {user ? null : <p className="-mt-2 m-0 text-haze">{t("app.today.title")}</p>}

        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start lg:gap-6">
          <div className="flex flex-col gap-4 lg:gap-6">
            {user ? (
              <section aria-labelledby="ask-h" className="panel relative flex flex-col gap-4 overflow-hidden border-gold/50 bg-[radial-gradient(120%_120%_at_100%_0%,#2A2350_0%,#14142A_60%)] p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-8">
                <div className="flex flex-1 flex-col gap-3">
                  <p className="m-0 flex flex-wrap items-center gap-2.5">
                    <span className="eyebrow">{t("app.ask.eyebrow")}</span>
                    <span className="text-xs text-haze">{t("app.ask.soon")}</span>
                  </p>
                  <h2 id="ask-h" className="m-0 font-display text-[28px] font-medium leading-tight lg:text-[40px]">{t("app.ask.title")}</h2>
                  <p className="m-0 hidden text-[15px] leading-relaxed text-haze lg:block">{t("app.today.ask_text")}</p>
                  <a href="/ask" className="btn-gold min-h-11 self-start px-6">{t("app.today.ask_button")}</a>
                </div>
                <span aria-hidden="true" className="relative hidden h-[180px] w-[190px] flex-none lg:block">
                  {[-14, -4, 12].map((r, i) => (
                    <span key={r} className="absolute top-2 block h-[150px] w-[96px] overflow-hidden rounded-[10px] [&_.card-back]:size-full" style={{ left: 20 + i * 34, transform: `rotate(${r}deg)` }}>
                      <CardBack />
                    </span>
                  ))}
                </span>
              </section>
            ) : null}

            <div className="flex flex-col gap-4 lg:grid lg:grid-cols-2 lg:gap-6">
              <SpreadCard t={t} count={1} title={t("app.today.one_title")} sub={t("app.today.one_sub")} today={one} start={{ href: "/draw/one", label: t("app.today.one_button") }} />
              <SpreadCard
                t={t}
                count={3}
                title={t("app.today.three_title")}
                sub={t("app.today.three_sub")}
                today={three}
                start={{ href: "/draw/three", label: t("app.today.three_button") }}
                locked={user ? undefined : { href: "/sign-up", label: t("app.today.three_locked") }}
              />
            </div>

            {due[0] ? (
              <a href={`/check-in/${due[0].sessionId}`} className="panel flex min-h-14 items-center justify-between gap-3 px-5 py-3 text-moon no-underline lg:hidden">
                <span>{due.length === 1 ? t("app.today.check_in_one") : t("app.today.check_in_many", { count: String(due.length) })}<span className="block text-sm text-muted">{t("app.today.check_in_sub")}</span></span>
                <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#D8B46A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              </a>
            ) : null}
            {user ? null : <p className="m-0 text-sm text-muted">{t("app.today.guest_note")}</p>}
            {footer}
          </div>

          {user ? (
            <aside className="hidden flex-col gap-6 lg:flex">
              <section aria-labelledby="wait-h" className="panel flex flex-col gap-1 p-6">
                <h2 id="wait-h" className="m-0 mb-2 text-base font-semibold">{t("app.today.waiting_title")}</h2>
                {due.length ? (
                  due.slice(0, 3).map((d) => (
                    <a key={d.sessionId} href={`/check-in/${d.sessionId}`} className="flex min-h-14 items-center justify-between gap-3 border-b border-gold/10 py-2 text-moon no-underline last:border-0">
                      <span className="text-sm">
                        {t("app.today.check_in_one")}
                        <span className="block text-xs text-muted">{t("app.today.check_in_item", { date: d.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: zone ?? "UTC" }) })}</span>
                      </span>
                      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="#D8B46A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    </a>
                  ))
                ) : (
                  <p className="m-0 text-sm text-muted">{t("app.today.waiting_none")}</p>
                )}
              </section>
              <section aria-labelledby="recent-h" className="panel flex flex-col gap-1 p-6">
                <h2 id="recent-h" className="m-0 mb-2 text-base font-semibold">{t("app.today.recent_title")}</h2>
                {recent.length ? (
                  recent.map((r) => (
                    <a key={r.id} href={`/reading/${r.id}`} className="flex flex-col gap-0.5 border-b border-gold/10 py-3 text-moon no-underline">
                      <span className="text-sm">{r.cardNames.join(" · ")}</span>
                      <span className="text-xs text-muted">{shortDay(r.localDay)} · {r.spread === "one" ? t("app.today.one_title") : t("app.today.three_title")}</span>
                    </a>
                  ))
                ) : (
                  <p className="m-0 text-sm text-muted">{t("app.today.recent_none")}</p>
                )}
                <a href="/journal" className="mt-3 text-sm">{t("app.today.open_journal")}</a>
              </section>
            </aside>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}

