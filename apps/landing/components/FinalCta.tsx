import { copy } from "@/content/copy";
import { links } from "@/content/site";

export function FinalCta() {
  return (
    <section aria-labelledby="h-final" className="relative overflow-hidden border-t border-gold/10 px-5 py-36 text-center sm:px-10">
      <div aria-hidden="true" className="orbit orbit--reverse absolute left-1/2 top-full h-[880px] w-[880px] -translate-x-1/2 -translate-y-[42%]">
        <svg viewBox="0 0 880 880" className="h-full w-full">
          <circle cx="440" cy="440" r="420" fill="none" stroke="rgba(216,180,106,.18)" strokeDasharray="80 16" />
          <circle cx="440" cy="440" r="300" fill="none" stroke="rgba(216,180,106,.12)" strokeDasharray="2 8" />
        </svg>
      </div>
      <div className="relative flex flex-col items-center gap-6">
        <h2 id="h-final" className="h2 text-[clamp(2.75rem,7vw,5.25rem)]" data-anim="reveal">{copy("landing.final.title")}</h2>
        <div data-anim="reveal"><a className="btn-gold" href={links.today}>{copy("landing.hero.primary")}</a></div>
        <span className="text-[13px] text-muted">{copy("landing.hero.note")}</span>
      </div>
    </section>
  );
}
