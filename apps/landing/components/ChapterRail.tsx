import { chapters } from "@/content/site";

export function ChapterRail() {
  return (
    <nav aria-label="Chapters" className="absolute right-10 top-1/2 hidden -translate-y-1/2 xl:block" data-anim="hero-intro">
      <ol className="m-0 flex list-none flex-col gap-3.5 p-0 text-right text-xs">
        {chapters.map((c, i) => (
          <li key={c.id}>
            <a href={`#${c.id}`} className={`no-underline ${i === 0 ? "text-gold" : "text-muted hover:text-moon"}`}>{c.label}</a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
