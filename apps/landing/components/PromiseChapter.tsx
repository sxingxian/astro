import { copy, copyLines } from "@/content/copy";

const ITEMS = [
  { mark: "i.", n: "one" },
  { mark: "ii.", n: "two" },
  { mark: "iii.", n: "three" },
  { mark: "iv.", n: "four" }
] as const;
import { ChapterIntro } from "./Chapter";

export function PromiseChapter() {
  return (
    <section id="promise" aria-labelledby="h-promise" tabIndex={-1} className="border-t border-gold/10 bg-[#0F0F1E] px-5 py-28 sm:px-10">
      <div className="mx-auto flex max-w-[1280px] flex-col gap-12">
        <ChapterIntro label={copy("landing.promise.chapter")} titleId="h-promise" title={copyLines("landing.promise.title")} align="center" />
        <ul className="m-0 grid list-none gap-px overflow-hidden rounded-[20px] border border-gold/20 bg-gold/20 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {ITEMS.map((p) => (
            // The cell keeps its background; only its contents reveal, so the gold grid colour never shows through.
            <li key={p.n} className="bg-[#0F0F1E] p-8">
              <div className="flex flex-col gap-3" data-anim="reveal">
                <span className="font-display text-[44px] text-gold" aria-hidden="true">{p.mark}</span>
                <h3 className="m-0 text-[19px] font-semibold">{copy(`landing.promise.${p.n}_title`)}</h3>
                <p className="m-0 leading-relaxed text-haze">{copy(`landing.promise.${p.n}_body`)}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
