export function JournalSwitch({ current }: { current: "readings" | "patterns" }) {
  const item = (href: string, label: string, on: boolean) => (
    <a href={href} aria-current={on ? "page" : undefined} className={`flex min-h-10 flex-1 items-center justify-center rounded-full text-sm no-underline ${on ? "bg-gold font-semibold text-night" : "text-haze"}`}>{label}</a>
  );
  return (
    <nav aria-label="Journal view" className="flex gap-1 rounded-full border border-gold/15 bg-ink p-1">
      {item("/journal", "Readings", current === "readings")}
      {item("/journal/patterns", "Patterns", current === "patterns")}
    </nav>
  );
}
