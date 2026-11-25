import { links } from "@/content/site";

export function Header() {
  return (
    <header className="absolute inset-x-0 top-0 z-20">
      <nav aria-label="Main" className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-5 py-6 sm:px-10" data-anim="hero-intro">
        <a href="#top" className="flex items-center gap-2.5 text-moon no-underline">
          <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" strokeWidth="1.3" strokeLinejoin="round" /></svg>
          <span className="font-display text-[26px] font-semibold">Astro</span>
        </a>
        <div className="flex items-center gap-3">
          <a href={links.signIn} className="flex min-h-11 items-center px-2 text-sm text-haze no-underline hover:text-moon">Sign in</a>
          <a href={links.today} className="btn-gold hidden min-h-11 px-5 text-sm sm:inline-flex">Draw today&apos;s card</a>
        </div>
      </nav>
    </header>
  );
}
