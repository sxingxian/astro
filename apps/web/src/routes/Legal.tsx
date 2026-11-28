import type { Doc } from "@astro/copy";
import { DocView } from "@/components/DocView";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { formatDate } from "@astro/copy/dates";

// Ported from apps/app/components/LegalPageView.tsx (same markup); data from GET /api/legal/:kind.
const TITLE = { terms: "app.legal.terms_meta", privacy: "app.legal.privacy_meta", guidelines: "app.legal.guidelines_meta" } as const;

export default function LegalPage({ page }: { page: "terms" | "privacy" | "guidelines" }) {
  const { t } = useSession();
  useTitle(t(TITLE[page]));
  const { data: legal, error } = useData<{ doc: Doc; version: number; publishedAt: string | null }>(`/api/legal/${page}`);
  if (error) return <Failed error={error} />;
  if (!legal) return <Loading />;
  return (
      <article data-page className="legal flex max-w-[720px] flex-col gap-6">
        <DocView doc={legal.doc} />
        {legal.version > 0 && legal.publishedAt ? (
          <p className="m-0 text-sm text-muted">{t("app.legal.updated", { date: formatDate(legal.publishedAt) })}</p>
        ) : null}
      </article>
  );
}
