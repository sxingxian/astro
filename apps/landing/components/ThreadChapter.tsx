import { thread } from "@/content/site";
import { CardFace } from "@astro/ui";
import { ChapterIntro } from "./Chapter";

export function ThreadChapter() {
  const ex = thread.example;
  return (
    <section id="thread" aria-labelledby="h-thread" tabIndex={-1} className="border-t border-gold/10 px-5 py-28 sm:px-10">
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-2">
        <div className="panel flex flex-col gap-5 p-6 sm:p-8" data-anim="reveal">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-[28px]">{ex.month}</span>
            <span className="text-xs text-muted">Example journal</span>
          </div>
          <div className="flex items-center gap-4">
            <CardFace id={ex.cardId} size="sm" className="shrink-0" />
            <p className="m-0 text-[15px] leading-relaxed text-[#CFCAE0]">
              {ex.summary[0]}<strong className="text-moon">{ex.summary[1]}</strong>{ex.summary[2]}
            </p>
          </div>
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0" aria-label="Suit balance">
            {ex.suits.map((s) => (
              <li key={s.name} className="grid grid-cols-[90px_1fr_40px] items-center gap-3 text-[13px]">
                <span className="text-haze">{s.name}</span>
                <span className="h-2 overflow-hidden rounded bg-nebula">
                  <span className="block h-2 origin-left bg-gold" data-anim="suit-bar" style={{ width: `${s.pct}%` }} />
                </span>
                <span className="text-right text-muted">{s.pct}%</span>
              </li>
            ))}
          </ul>
          <p className="m-0 rounded-xl bg-[#1A1736] px-4 py-3.5 text-sm text-[#CFCAE0]">
            {ex.checkIn} <span className="text-gold">How did it turn out?</span>
          </p>
        </div>
        <ChapterIntro label={thread.chapter} titleId="h-thread" title={thread.title} lede={thread.lede} />
      </div>
    </section>
  );
}
