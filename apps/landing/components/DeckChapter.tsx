import { CardBack, CardFace } from "@astro/ui";
import { copy, copyLines } from "@/content/copy";
import { deckCardId } from "@/content/site";
import { ChapterIntro } from "./Chapter";

const CHOSEN_INDEX = 13;

/** Fan geometry shared with the motion layer: −31.5° + i × 3°, origin 900px below. */
export const fan = Array.from({ length: 22 }, (_, i) => ({
  index: i,
  angle: -31.5 + i * 3,
  riffle: (i % 2 === 0 ? 1 : -1) * (54 + (i % 5) * 6),
  chosen: i === CHOSEN_INDEX
}));

export function DeckChapter() {
  return (
    <section id="deck" aria-labelledby="h-deck" tabIndex={-1} className="relative border-t border-gold/10 px-5 pb-16 pt-28 sm:px-10">
      <div className="mx-auto max-w-[1280px]">
        <ChapterIntro label={copy("landing.deck.chapter")} titleId="h-deck" title={copyLines("landing.deck.title")} lede={copy("landing.deck.lede")} align="center" />
      </div>
      <div className="deck-stage">
        <div className="deck" data-anim="deck" aria-hidden="true">
          {fan.map((card) =>
            card.chosen ? (
              <div
                key={card.index}
                className="deck-card deck-card--chosen"
                data-anim="deck-chosen"
                data-angle={card.angle}
                data-riffle={card.riffle}
                data-index={card.index}
                style={{ transform: `rotate(${card.angle}deg) translateY(-60px)` }}
              >
                <div className="deck-glow" data-anim="deck-glow" />
                <div className="deck-flipper" data-anim="deck-flipper">
                  <CardBack className="deck-side" />
                  <CardFace id={deckCardId} size="lg" className="deck-side deck-side--face" />
                </div>
              </div>
            ) : (
              <CardBack
                key={card.index}
                className="deck-card"
                anim="deck-card"
                data={{ angle: card.angle, riffle: card.riffle, index: card.index }}
                style={{ transform: `rotate(${card.angle}deg)` }}
              />
            )
          )}
        </div>
      </div>
      <ol className="steps" aria-label={copy("landing.deck.steps_label")}>
        {[copy("landing.deck.step_1"), copy("landing.deck.step_2"), copy("landing.deck.step_3")].map((step, i) => (
          <li key={i} className="step" data-anim="deck-step">
            <b>{i + 1}</b>
            {step}
          </li>
        ))}
      </ol>
    </section>
  );
}
