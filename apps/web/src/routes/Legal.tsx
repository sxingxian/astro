import type { Doc } from "@astro/copy";
import { DocView } from "@/components/DocView";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";

// Ported from apps/app/components/LegalPageView.tsx (same markup); data from GET /api/legal/:kind.
export default function LegalPage({ page }: { page: "terms" | "privacy" }) {
  const { t } = useSession();
  useTitle(t(page === "terms" ? "app.legal.terms_meta" : "app.legal.privacy_meta"));
  const { data: legal, error } = useData<{ doc: Doc; version: number; publishedAt: string | null }>(`/api/legal/${page}`);
  if (error) return <Failed error={error} />;
  if (!legal) return <Loading />;
  return (
      <article data-page className="legal flex max-w-[720px] flex-col gap-6">
        <DocView doc={legal.doc} />
        {legal.version > 0 && legal.publishedAt ? (
          <p className="m-0 text-sm text-muted">{t("app.legal.updated", { date: new Date(legal.publishedAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}</p>
        ) : null}
      </article>
  );
}
