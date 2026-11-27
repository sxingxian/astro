import { getCard } from "@astro/cards";
import { useParams } from "react-router";
import { VerifyCheck } from "@/components/draw/VerifyCheck";
import type { Reading } from "@/lib/draw/service";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/app/reading/[id]/verify/page.tsx (same markup); data from GET /api/reading/:id.
const TITLE = { single: "app.verify.deck_single", majors: "app.verify.deck_majors", minors: "app.verify.deck_minors" } as const;

export default function VerifyPage() {
  const { id = "" } = useParams();
  const { t, user } = useSession();
  useTitle(t("app.verify.meta"));
  const { data, error } = useData<{ reading: Reading }>(`/api/reading/${encodeURIComponent(id)}`);
  const current = user ? "journal" : "today";
  if (error) return <AppShell current={current}><Failed error={error} /></AppShell>;
  if (!data) return <AppShell current={current}><Loading /></AppShell>;
  const { reading } = data;
  if (!reading.reveal) {
    window.location.replace(`/reading/${id}`);
    return <AppShell current={current}><Loading /></AppShell>;
  }
  const reveal = reading.reveal;

  return (
    <AppShell current={user ? "journal" : "today"}>
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-8 lg:max-w-none lg:px-0 lg:pb-16 lg:pt-4">
        <a href={`/reading/${id}`} className="text-sm">{t("app.verify.back")}</a>
        <div className="flex max-w-[720px] flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-medium lg:text-5xl">{t("app.verify.title")}</h1>
          <p className="m-0 leading-relaxed text-haze">{t("app.verify.lede")}</p>
        </div>
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
          {reveal.map((r) => {
            const deck = reading.decks.find((d) => d.stage === r.stage);
            if (!deck) return null;
            return <VerifyCheck key={r.stage} title={t(TITLE[r.stage])} order={r.order} names={r.order.map((cid) => getCard(cid).name)} orientations={r.orientations} salt={r.salt} fingerprint={deck.fingerprint} picks={deck.picks} />;
          })}
        </div>
        <p className="m-0 text-xs text-muted">{t("app.verify.footnote")}</p>
      </div>
    </AppShell>
  );
}
