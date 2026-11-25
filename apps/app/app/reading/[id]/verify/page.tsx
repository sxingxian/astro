import { getCard } from "@astro/cards";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { VerifyCheck } from "@/components/draw/VerifyCheck";
import { getDb } from "@/lib/db";
import { viewer } from "@/lib/draw/actor";
import { DrawError } from "@/lib/draw/errors";
import { getReading } from "@/lib/draw/service";

export const metadata = { title: "Verify this shuffle" };

const TITLE = { single: "The deck", majors: "Major Arcana deck", minors: "Minor Arcana deck" };

export default async function VerifyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor } = await viewer(await headers());
  if (!actor) notFound();
  let reading;
  try {
    reading = await getReading(getDb(), actor, id);
  } catch (e) {
    if (e instanceof DrawError) notFound();
    throw e;
  }
  if (!reading.reveal) redirect(`/reading/${id}`);

  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-16 pt-8">
      <a href={`/reading/${id}`} className="text-sm">← Back to the reading</a>
      <div className="flex flex-col gap-2">
        <h1 className="m-0 font-display text-4xl font-medium">Verify this shuffle</h1>
        <p className="m-0 leading-relaxed text-haze">Before you chose, we showed a fingerprint of each shuffled deck. Here is the full order, each card's orientation and the secret salt behind it, so you can confirm nothing changed after you picked. Your browser does the check.</p>
      </div>
      {reading.reveal.map((r) => {
        const deck = reading.decks.find((d) => d.stage === r.stage);
        if (!deck) return null;
        return <VerifyCheck key={r.stage} title={TITLE[r.stage]} order={r.order} names={r.order.map((cid) => getCard(cid).name)} orientations={r.orientations} salt={r.salt} fingerprint={deck.fingerprint} picks={deck.picks} />;
      })}
      <p className="m-0 text-xs text-muted">The order and salt are only revealed after a reading is complete, so they can't be used to see cards in advance.</p>
    </div>
  );
}
