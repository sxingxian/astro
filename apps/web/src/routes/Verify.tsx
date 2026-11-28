import { getCard } from "@astro/cards";
import { useParams } from "react-router";
import { VerifyCheck } from "@/components/draw/VerifyCheck";
import type { Reading } from "@astro/app-core/draw/service";
import { Failed, Loading, useData } from "../data";
import { go } from "../nav";
import { useSession, useTitle } from "../session";

// Ported from apps/app/app/reading/[id]/verify/page.tsx (same markup); data from GET /api/reading/:id.
const TITLE = { single: "app.verify.deck_single", majors: "app.verify.deck_majors", minors: "app.verify.deck_minors" } as const;

export default function VerifyPage() {
  const { id = "" } = useParams();
  const { t } = useSession();
  useTitle(t("app.verify.meta"));
  const { data, error } = useData<{ reading: Reading }>(`/api/reading/${encodeURIComponent(id)}`);
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  const { reading } = data;
  if (!reading.reveal) {
    go(`/reading/${id}`, { replace: true });
    return <Loading />;
  }
  const reveal = reading.reveal;

  return (
      <div data-page className="flex flex-col gap-6">
        <a href={`/reading/${id}`} className="hidden text-sm lg:inline">{t("app.verify.back")}</a>
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
  );
}
