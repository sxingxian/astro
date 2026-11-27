import { getCard } from "@astro/cards";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { VerifyCheck } from "@/components/draw/VerifyCheck";
import { getDb } from "@/lib/db";
import { viewer } from "@/lib/draw/actor";
import { DrawError } from "@/lib/draw/errors";
import { getReading } from "@/lib/draw/service";
import { getCopy } from "@/lib/copy";

export async function generateMetadata() {
  return { title: (await getCopy())("app.verify.meta") };
}

const TITLE = { single: "app.verify.deck_single", majors: "app.verify.deck_majors", minors: "app.verify.deck_minors" } as const;

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, user: viewerUser } = await viewer(await headers());
  if (!actor) notFound();
  let reading;
  try {
    reading = await getReading(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DrawError) notFound();
    throw e;
  }
  if (!reading.reveal) redirect(`/reading/${id}`);
  const t = await getCopy();

  return (
    <AppShell current={viewerUser ? "journal" : "today"}>
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-8 lg:max-w-none lg:px-0 lg:pb-16 lg:pt-4">
        <a href={`/reading/${id}`} className="text-sm">{t("app.verify.back")}</a>
        <div className="flex max-w-[720px] flex-col gap-2">
          <h1 className="m-0 font-display text-4xl font-medium lg:text-5xl">{t("app.verify.title")}</h1>
          <p className="m-0 leading-relaxed text-haze">{t("app.verify.lede")}</p>
        </div>
        <div className="flex flex-col gap-6 lg:grid lg:grid-cols-2 lg:items-start">
          {reading.reveal.map((r) => {
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
