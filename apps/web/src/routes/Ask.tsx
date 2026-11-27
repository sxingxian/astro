import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/app/ask/page.tsx (same markup).
/** Ask: "Coming soon" until paid readings open in Plan 4 Part 2. Collects nothing. */
export default function AskPage() {
  const { t, user } = useSession();
  useTitle(t("app.ask.meta"));
  const option = (title: string, text: string) => (
    <div className="panel flex flex-col gap-2 p-5">
      <h2 className="m-0 font-display text-2xl font-medium">{title}</h2>
      <p className="m-0 text-sm leading-relaxed text-haze">{text}</p>
    </div>
  );
  return (
    <AppShell current="ask">
      <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-16 pt-8 lg:max-w-none">
        <section className="flex flex-col gap-4 rounded-3xl border border-gold bg-[radial-gradient(90%_140%_at_100%_0%,#3A2F6B_0%,#1C1838_45%,#14142A_100%)] p-6 lg:p-8">
          <p className="m-0 flex flex-wrap items-center gap-3">
            <span className="eyebrow">{t("app.ask.eyebrow")}</span>
            <span className="rounded-full border border-gold/40 px-2.5 py-0.5 text-xs text-gold">{t("app.ask.soon")}</span>
          </p>
          <h1 className="m-0 font-display text-4xl font-medium leading-tight lg:text-5xl">{t("app.ask.title")}</h1>
          <p className="m-0 leading-relaxed text-haze">{t("app.ask.lede")}</p>
        </section>
        <div className="grid gap-4 lg:grid-cols-2">
          {option(t("app.ask.ai_title"), t("app.ask.ai_text"))}
          {option(t("app.ask.reader_title"), t("app.ask.reader_text"))}
        </div>
        {user ? (
          <p className="m-0 text-haze">{t("app.ask.member_note")}</p>
        ) : (
          <div className="flex flex-col gap-3">
            <p className="m-0 text-sm text-haze">{t("app.ask.guest_note")}</p>
            <a href="/sign-up" className="btn-gold self-start">{t("app.ask.guest_cta")}</a>
          </div>
        )}
      </div>
    </AppShell>
  );
}
