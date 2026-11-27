import { copy, copyVersion } from "@/content/copy";

export function Footer() {
  const version = copyVersion();
  return (
    <footer className="border-t border-gold/10">
      <div className="mx-auto flex max-w-[1280px] flex-wrap justify-between gap-6 px-5 py-12 text-[13px] text-muted sm:px-10">
        <p className="m-0"><span className="font-display text-xl text-moon">Astro</span> · {copy("landing.footer.disclaimer")}</p>
        <p className="m-0 flex flex-wrap gap-5">
          <a href="/terms">{copy("landing.footer.terms")}</a>
          <a href="/privacy">{copy("landing.footer.privacy")}</a>
          <span>{copy("landing.footer.copyright")}</span>
          {/* Which published wording this build carries, so a publish can be confirmed live. */}
          {version > 0 ? <span title="Wording version">{`v${version}`}</span> : null}
        </p>
      </div>
    </footer>
  );
}
