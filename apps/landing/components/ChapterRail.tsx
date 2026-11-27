import { copy } from "@/content/copy";
import { chapterIds } from "@/content/site";

const LABELS = ["landing.rail.sky", "landing.rail.deck", "landing.rail.pairs", "landing.rail.thread", "landing.rail.promise", "landing.rail.deeper"] as const;

export function ChapterRail() {
  return (
    <nav aria-label={copy("landing.rail.label")} className="absolute right-10 top-1/2 hidden -translate-y-1/2 xl:block" data-anim="hero-intro">
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-right text-xs">
        {chapterIds.map((id, i) => (
          <li key={id}>
            <a href={`#${id}`} className={`no-underline ${i === 0 ? "text-gold" : "text-muted hover:text-moon"}`}>{copy(LABELS[i]!)}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
