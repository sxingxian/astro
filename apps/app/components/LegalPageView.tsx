import { AppShell } from "./AppShell";
import { DocView } from "./DocView";
import { getCopy, previewId } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { loadLegalPage, type LegalPage } from "@/lib/legal";

/** A public legal page: the published document and when it was last published. */
export async function LegalPageView({ page }: { page: LegalPage }) {
  const [t, legal] = await Promise.all([getCopy(), loadLegalPage(getDb(), page, await previewId())]);
  return (
    <AppShell>
    <article data-page className="legal mx-auto flex max-w-[720px] flex-col gap-6 px-5 pb-32 pt-10 lg:px-0 lg:pb-16 lg:pt-4">
      <DocView doc={legal.doc} />
      {legal.version > 0 && legal.publishedAt ? (
        <p className="m-0 text-sm text-muted">{t("app.legal.updated", { date: legal.publishedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }) })}</p>
      ) : null}
    </article>
    </AppShell>
  );
}
