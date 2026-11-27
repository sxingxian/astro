import { copy, copyLines } from "@/content/copy";
import { links } from "@/content/site";

const TIERS = [
  { id: "ai", href: links.deeperAi, featured: false },
  { id: "human", href: links.deeperHuman, featured: true }
] as const;
import { ChapterIntro } from "./Chapter";

export function DeeperChapter() {
  return (
    <section id="deeper" aria-labelledby="h-deeper" tabIndex={-1} className="border-t border-gold/10 px-5 py-28 sm:px-10">
      <div className="mx-auto grid max-w-[1280px] items-stretch gap-6 lg:grid-cols-3">
        <ChapterIntro label={copy("landing.deeper.chapter")} titleId="h-deeper" title={copyLines("landing.deeper.title")} lede={copy("landing.deeper.lede")} titleClass="text-[clamp(2.5rem,5vw,3.75rem)]" />
        {TIERS.map((t) => (
          <div key={t.id} className="flex" data-anim="reveal">
            <a href={t.href} className={`panel lift flex flex-1 flex-col gap-3.5 p-8 text-moon no-underline ${t.featured ? "border-gold" : ""}`}>
              <span className="text-xs uppercase tracking-[0.14em] text-muted">{copy(`landing.deeper.${t.id}_kicker`)}</span>
              <span className="font-display text-4xl">{copy(`landing.deeper.${t.id}_name`)}</span>
              <span className="leading-relaxed text-haze">{copy(`landing.deeper.${t.id}_body`)}</span>
              <span className="mt-auto font-display text-2xl">{copy("landing.deeper.price")}</span>
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
