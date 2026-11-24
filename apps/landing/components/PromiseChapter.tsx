import { promises } from "@/content/site";
import { ChapterIntro } from "./Chapter";

export function PromiseChapter() {
  return (
    <section id="promise" aria-labelledby="h-promise" tabIndex={-1} className="border-t border-gold/10 bg-[#0F0F1E] px-5 py-28 sm:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12">
        <ChapterIntro label={promises.chapter} titleId="h-promise" title={promises.title} align="center" />
        <ul className="m-0 grid list-none gap-px overflow-hidden rounded-[20px] border border-gold/20 bg-gold/20 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {promises.items.map((p) => (
            <li key={p.title} className="flex flex-col gap-3 bg-[#0F0F1E] p-8" data-anim="reveal">
              <span className="font-display text-[44px] text-gold" aria-hidden="true">{p.mark}</span>
              <h3 className="m-0 text-[19px] font-semibold">{p.title}</h3>
              <p className="m-0 leading-relaxed text-haze">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
