import type { ReactNode } from "react";
import { copy, copyLines } from "@/content/copy";
import { links } from "@/content/site";
import { CardBack } from "@astro/ui";
import { ChapterRail } from "./ChapterRail";
import { StaticSky } from "./StaticSky";

export function Hero({ sky }: { sky?: ReactNode }) {
  return (
    <section id="top" aria-labelledby="h-sky" tabIndex={-1} className="relative flex min-h-[900px] items-center justify-center overflow-hidden text-center">
      <StaticSky />
      {sky}
      <div aria-hidden="true" className="orbit absolute left-1/2 top-[52%] h-[1060px] w-[1060px] -translate-x-1/2 -translate-y-1/2">
        <svg viewBox="0 0 1060 1060" className="h-full w-full">
          <circle cx="530" cy="530" r="300" fill="none" stroke="rgba(216,180,106,.16)" />
          <circle cx="530" cy="530" r="400" fill="none" stroke="rgba(216,180,106,.12)" strokeDasharray="2 8" />
          <circle cx="530" cy="530" r="520" fill="none" stroke="rgba(216,180,106,.06)" strokeDasharray="60 14" />
        </svg>
      </div>
      <div data-anim="hero-out" className="relative flex flex-col items-center gap-7 px-5 pb-20 pt-36 sm:px-10">
        <div className="[perspective:1000px]">
          <div data-anim="hero-card" className="[transform-style:preserve-3d]">
            <CardBack className="h-[200px] w-[120px] [transform:rotateY(-24deg)_rotateX(10deg)] shadow-[0_30px_80px_rgba(0,0,0,.6),0_0_80px_rgba(216,180,106,.15)]" />
          </div>
        </div>
        <span className="chapter" data-anim="hero-intro">{copy("landing.hero.chapter")}</span>
        <h1 id="h-sky" className="m-0 max-w-[1000px] font-display text-[clamp(3.25rem,9vw,6.5rem)] font-medium leading-[0.95] tracking-[-0.015em]">
          {copyLines("landing.hero.title").map((line, i, all) =>
            // The last line is the gold, italic one.
            i === all.length - 1 ? (
              <span key={i} className="line"><em className="line-in text-gold" data-anim="hero-line">{line}</em></span>
            ) : (
              <span key={i}><span className="line"><span className="line-in" data-anim="hero-line">{line}</span></span>{" "}</span>
            )
          )}
        </h1>
        <p className="lede text-center" data-anim="hero-intro">{copy("landing.hero.lede")}</p>
        <div className="flex flex-wrap justify-center gap-3.5" data-anim="hero-intro">
          <a className="btn-gold" href={links.today}>{copy("landing.hero.primary")}</a>
          <a className="btn-ghost" href="#deck">{copy("landing.hero.secondary")}</a>
        </div>
        <p className="m-0 text-[13px] text-muted" data-anim="hero-intro">{copy("landing.hero.note")}</p>
      </div>
      <ChapterRail />
    </section>
  );
}
