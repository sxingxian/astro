import { DeckChapter } from "@/components/DeckChapter";
import { DeeperChapter } from "@/components/DeeperChapter";
import { FinalCta } from "@/components/FinalCta";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { PairsChapter } from "@/components/PairsChapter";
import { PromiseChapter } from "@/components/PromiseChapter";
import { ThreadChapter } from "@/components/ThreadChapter";
import { MotionProvider } from "@/components/motion/MotionProvider";

export default function Page() {
  return (
    <MotionProvider>
      <div className="progress" data-anim="progress" aria-hidden="true" />
      <Header />
      <Hero />
      <DeckChapter />
      <PairsChapter />
      <ThreadChapter />
      <PromiseChapter />
      <DeeperChapter />
      <FinalCta />
      <Footer />
    </MotionProvider>
  );
}
