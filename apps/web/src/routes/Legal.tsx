import type { Doc } from "@astro/copy";
import { DocView } from "@/components/DocView";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/components/LegalPageView.tsx (same markup); data from GET /api/legal/:kind.
export default function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const { t } = useSession();
  useTitle(t(page === "terms" ? "app.legal.terms_meta" : "app.legal.privacy_meta"));
  const { data: legal, error } = useData<{ doc: Doc; version: number; publishedAt: string | null }>(`/api/legal/${page}`);
  if (error) return <AppShell><Failed error={error} /></AppShell>;
  if (!legal) return <AppShell><Loading /></AppShell>;
  return (
    <AppShell>
      <article data-page className="legal mx-auto flex max-w-[720px] flex-col gap-6 px-5 pb-32 pt-10 lg:px-0 lg:pb-16 lg:pt-4">
        <DocView doc={legal.doc} />
        {legal.version > 0 && legal.publishedAt ? (
          <p className="m-0 text-sm text-muted">{t("app.legal.updated", { date: new Date(legal.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}</p>
        ) : null}
      </article>
    </AppShell>
  );
}
