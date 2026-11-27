import { CardFace } from "@astro/ui";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { FlipCard } from "@/components/draw/FlipCard";
import { ReadingNotes } from "@/components/journal/ReadingNotes";
import { AppShell } from "@/components/AppShell";
import { getDb } from "@/lib/db";
import { viewer } from "@/lib/draw/actor";
import { describe } from "@/lib/draw/describe";
import { DrawError } from "@/lib/draw/errors";
import { getReading, type Reading } from "@/lib/draw/service";
import { getNote } from "@/lib/journal";
import { getCopy } from "@/lib/copy";
import { getMeanings } from "@/lib/meanings";

export async function generateMetadata() {
  return { title: (await getCopy())("app.reading.meta") };
}

const POSITIONS = ["past", "present", "future"] as const;
const LABEL = { past: "app.draw.past", present: "app.draw.present", future: "app.draw.future" } as const;

async function load(id: string) {
  const { actor, user } = await viewer(await headers());
  if (!actor) notFound();
  try {
    return { reading: await getReading(getDb(), actor, id), user };
  } catch (e) {
    if (e instanceof DrawError) notFound();
    throw e;
  }
}

const dayLabel = (r: Reading) => new Date(`${r.localDay}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

export default async function ReadingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { reading, user } = await load(id);
  if (reading.status !== "complete") redirect(reading.spread === "one" ? "/draw/one" : "/draw/three");
  const note = user ? await getNote(getDb(), user.id, reading.sessionId) : null;
  const [tr, meaningOf] = await Promise.all([getCopy(), getMeanings()]);

  const footer = (
    <div className="flex flex-col gap-4">
      {user ? (
        <>
          <ReadingNotes sessionId={reading.sessionId} note={note} isPrivate={reading.private} />
          <p className="m-0 text-sm text-muted">{tr("app.reading.saved")}</p>
        </>
      ) : (
        <div className="panel flex flex-col gap-3 p-5">
          <p className="m-0 font-display text-2xl">{tr("app.reading.keep_title")}</p>
          <p className="m-0 text-sm leading-relaxed text-haze">{tr("app.reading.keep_text")}</p>
          <a className="btn-gold" href="/sign-up">{tr("app.reading.keep_button")}</a>
        </div>
      )}
      <a href={`/reading/${reading.sessionId}/verify`}>{tr("app.reading.verify_link")}</a>
      <p className="m-0 text-xs text-muted">{tr("app.reading.disclaimer")}</p>
    </div>
  );

  if (reading.spread === "one") {
    const drawn = reading.decks[0]?.cards[0];
    if (!drawn) notFound();
    const t = describe(drawn.cardId, drawn.orientation, tr, meaningOf);
    return (
    <AppShell current="today">
      <article className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-8">
        <p className="eyebrow">{tr("app.reading.one_eyebrow", { date: dayLabel(reading) })}</p>
        <div className="flex flex-col items-center gap-2 py-2">
          <FlipCard width={104} height={176}><CardFace id={t.card.id} size="lg" reversed={t.reversed} /></FlipCard>
          {t.reversed ? <span className="card-reversed">{tr("app.card.reversed")}</span> : null}
        </div>
        <header className="flex flex-col gap-2 text-center">
          <h1 className="m-0 font-display text-5xl font-medium leading-none">{t.title}</h1>
          <p className="m-0 text-sm text-muted">{t.line}</p>
          <ul className="m-0 flex list-none flex-wrap justify-center gap-2 p-0">
            {t.card.keywords.map((k) => <li key={k} className="rounded-full border border-gold/30 px-3 py-1 text-xs text-haze">{k}</li>)}
          </ul>
        </header>
        <section aria-labelledby="meaning" className="flex flex-col gap-4">
          <h2 id="meaning" className="eyebrow">{tr("app.reading.meaning")}</h2>
          <p data-testid="meaning-summary" className="m-0 font-display text-2xl leading-snug">{t.side.summary}</p>
          {t.side.body.map((p, i) => <p key={i} className="m-0 leading-relaxed text-haze">{p}</p>)}
        </section>
        {footer}
      </article>
    </AppShell>
  );
  }

  const majorsDeck = reading.decks.find((d) => d.stage === "majors");
  const minorsDeck = reading.decks.find((d) => d.stage === "minors");
  return (
    <AppShell current="today">
    <article className="mx-auto flex max-w-[560px] flex-col gap-8 px-5 pb-32 pt-8">
      <div className="flex flex-col gap-2">
        <p className="eyebrow">{tr("app.reading.three_eyebrow", { date: dayLabel(reading) })}</p>
        <h1 className="m-0 font-display text-4xl font-medium leading-tight">{tr("app.reading.three_title")}</h1>
      </div>
      {POSITIONS.map((pos, i) => {
        const major = majorsDeck?.cards[i];
        const minor = minorsDeck?.cards[i];
        if (!major || !minor) return null;
        const m = describe(major.cardId, major.orientation, tr, meaningOf);
        const c = describe(minor.cardId, minor.orientation, tr, meaningOf);
        return (
          <section key={pos} aria-labelledby={`h-${pos}`} className="panel flex flex-col gap-4 p-5">
            <h2 id={`h-${pos}`} className="eyebrow">{tr(LABEL[pos])}</h2>
            <div className="flex items-end gap-3">
              <div className="flex flex-col items-center gap-1.5">
                <FlipCard width={92} height={156} delay={i * 160}><CardFace id={m.card.id} size="md" reversed={m.reversed} className="!h-full !w-full" /></FlipCard>
                {m.reversed ? <span className="card-reversed">{tr("app.card.reversed")}</span> : null}
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <FlipCard width={76} height={124} delay={i * 160 + 80}><CardFace id={c.card.id} size="sm" label={tr("app.card.clarifier")} reversed={c.reversed} className="!h-full !w-full bg-[#1A1736]" /></FlipCard>
                {c.reversed ? <span className="card-reversed">{tr("app.card.reversed")}</span> : null}
              </div>
            </div>
            <p className="m-0 font-display text-2xl leading-snug">{m.title} <span className="text-muted">{tr("app.reading.with")}</span> {c.title}</p>
            <p data-testid="meaning-summary" className="m-0 leading-relaxed">{m.meaning.positions[pos]} {m.side.summary}.</p>
            <p className="m-0 leading-relaxed text-haze">{m.meaning.asTheme} {c.meaning.asClarifier} {c.side.summary}.</p>
            <details className="text-sm">
              <summary className="cursor-pointer text-gold">{tr("app.reading.read_both")}</summary>
              <div className="mt-3 flex flex-col gap-3 leading-relaxed text-haze">
                <p className="m-0 font-semibold text-moon">{m.title}</p>
                {m.side.body.map((p, k) => <p key={`m${k}`} className="m-0">{p}</p>)}
                <p className="m-0 font-semibold text-moon">{c.title}</p>
                {c.side.body.map((p, k) => <p key={`c${k}`} className="m-0">{p}</p>)}
              </div>
            </details>
          </section>
        );
      })}
      {footer}
    </article>
    </AppShell>
  );
}
