import { useSession } from "../session";

// Ported from apps/app/components/journal/JournalSwitch.tsx.
export function JournalSwitch({ current }: { current: "readings" | "patterns" }) {
  const { t } = useSession();
  const item = (href: string, label: string, on: boolean) => (
    <a href={href} aria-current={on ? "page" : undefined} className={`flex min-h-10 flex-1 items-center justify-center rounded-full text-sm no-underline ${on ? "bg-nebula font-semibold text-moon" : "text-haze"}`}>{label}</a>
  );
  return (
    <nav aria-label={t("app.journal.switch_label")} className="flex gap-1 rounded-full border border-gold/15 bg-ink p-1">
      {item("/journal", t("app.journal.readings"), current === "readings")}
      {item("/journal/patterns", t("app.journal.patterns"), current === "patterns")}
    </nav>
  );
}
