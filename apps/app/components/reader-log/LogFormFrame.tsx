import type { ReactNode } from "react";
import type { T } from "@/lib/copy";

/** The record and edit pages: a back link, the heading and the privacy promise above the form. */
export function LogFormFrame({ title, t, children }: { title: string; t: T; children: ReactNode }) {
  return (
    <div data-page className="mx-auto flex max-w-[560px] flex-col gap-5 px-5 pb-32 pt-6 lg:pb-16">
      <header className="flex items-center gap-2">
        <a href="/desk/log" aria-label={t("app.log.back")} className="-ml-2 flex size-11 items-center justify-center text-moon">
          <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </a>
        <h1 className="m-0 font-display text-3xl font-medium">{title}</h1>
      </header>
      <p className="m-0 text-sm text-haze">{t("app.log.private")}</p>
      {children}
    </div>
  );
}
