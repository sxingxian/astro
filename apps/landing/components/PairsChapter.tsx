import { pairs } from "@/content/site";
import { CardFace } from "./CardFace";
import { ChapterIntro } from "./Chapter";

export function PairsChapter() {
  return (
    <section id="pairs" aria-labelledby="h-pairs" tabIndex={-1} className="border-t border-gold/10 bg-[#0F0F1E] px-5 py-28 sm:px-10">
      <div className="mx-auto grid max-w-[1280px] items-center gap-16 lg:grid-cols-2">
        <ChapterIntro label={pairs.chapter} titleId="h-pairs" title={pairs.title} lede={pairs.lede} />
        <div className="pairs-stage min-w-0">
          <div className="pairs-grid">
            {pairs.items.map((p) => (
              <div key={p.position} className="flex flex-col items-center gap-3.5">
                <span className="text-xs uppercase tracking-[0.18em] text-muted">{p.position}</span>
                <div className="relative h-[300px] w-[150px]">
                  <div className="absolute left-0 top-0" data-anim="pair-major">
                    <CardFace id={p.major} size="md" />
                  </div>
                  <div className="absolute bottom-0 right-0" data-anim="pair-minor" style={{ transform: "rotate(6deg)" }}>
                    <CardFace id={p.minor} size="sm" label="Clarifier" className="bg-[#1A1736] shadow-[0_16px_36px_rgba(0,0,0,.6)]" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
