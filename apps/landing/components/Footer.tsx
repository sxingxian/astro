import { DISCLAIMER } from "@/content/site";

export function Footer() {
  return (
    <footer className="border-t border-gold/10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-6 px-5 py-12 text-[13px] text-muted sm:px-10">
        <p className="m-0"><span className="font-display text-xl text-moon">Astro</span> · {DISCLAIMER}</p>
        <p className="m-0 flex flex-wrap gap-5">
          <a href="/terms">Terms</a>
          <a href="/privacy">Privacy</a>
          <span>© 2026 Midnight Poetry Studio</span>
        </p>
      </div>
    </footer>
  );
}
