import Link from "next/link";
import { NoAccess } from "@/components/NoAccess";
import { PageHeader } from "@/components/PageHeader";
import { TextClient } from "@/components/text/TextClient";
import { getDb } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { pageStaff } from "@/lib/page";
import { LegalClient } from "@/components/text/LegalClient";
import { LEGAL_KINDS, legalScreen, textScreen, type LegalKind, type TextTab } from "@/lib/text";

export const metadata = { title: "Text" };
export const dynamic = "force-dynamic";

const TABS: { tab: TextTab; label: string; href: string }[] = [
  { tab: "landing", label: "Landing page", href: "/text" },
  { tab: "app", label: "App", href: "/text?tab=app" },
  { tab: "email", label: "Emails", href: "/text?tab=email" },
  { tab: "legal", label: "Legal", href: "/text?tab=legal" }
];

export default async function TextPage({ searchParams }: { searchParams: Promise<{ tab?: string; page?: string }> }) {
  const staff = await pageStaff("text.edit");
  if (!staff) return <NoAccess />;
  const sp = await searchParams;
  const requested = sp.tab;
  const tab: TextTab = requested === "app" || requested === "email" || requested === "legal" ? requested : "landing";
  const page: LegalKind = LEGAL_KINDS.includes(sp.page as LegalKind) ? (sp.page as LegalKind) : "terms";
  return (
    <>
      <PageHeader title="Text" lede="Every word visitors see. Your edits are drafts until you publish.">
        <nav aria-label="Where the text appears" className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.tab}
              href={t.href}
              aria-current={t.tab === tab ? "page" : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm no-underline ${t.tab === tab ? "border-gold bg-gold font-semibold text-night" : "border-gold/25 text-haze"}`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
      </PageHeader>
      {tab === "legal" ? <LegalView page={page} /> : <TabView tab={tab} />}
    </>
  );
}

async function LegalView({ page }: { page: LegalKind }) {
  const screen = await legalScreen(getDb(), page);
  return <LegalClient key={page} page={page} items={screen.items} live={screen.live} history={screen.history} appUrl={getEnv().APP_URL} />;
}

async function TabView({ tab }: { tab: Exclude<TextTab, "legal"> }) {
  const screen = await textScreen(getDb(), tab);
  return <TextClient key={tab} tab={tab} items={screen.items} pending={screen.pending} live={screen.live} history={screen.history} appUrl={getEnv().APP_URL} />;
}
