import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { DocView } from "@/components/DocView";
import { GuidelinesAgree } from "@/components/GuidelinesAgree";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { getSessionUser } from "@/lib/auth";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { loadLegalPage } from "@/lib/legal";
import { readerStatus } from "@/lib/readers";

export async function generateMetadata() {
  return { title: (await getCopy())("app.desk.meta") };
}
export const dynamic = "force-dynamic";

/** The reader's Desk. In Part 1: My log, and a note that requests come with paid readings. Readers only. */
export default async function DeskPage() {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const db = getDb();
  const [t, status] = await Promise.all([getCopy(), readerStatus(db, user.id)]);
  if (!status.reader) redirect("/today");
  const guidelines = status.accepted ? null : await loadLegalPage(db, "guidelines", null, { cache: false });
  return (
    <AppShell current="desk" reader>
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-8 lg:max-w-[880px] lg:pb-16">
        <header className="flex flex-col gap-2">
          <p className="eyebrow">{t("app.desk.eyebrow")}</p>
          <h1 className="m-0 font-display text-4xl font-medium leading-tight">{t("app.desk.title")}</h1>
        </header>
        {guidelines ? (
          <section aria-labelledby="g-h" className="panel flex flex-col gap-4 p-5">
            <h2 id="g-h" className="m-0 font-display text-2xl">{t("app.desk.guidelines_title")}</h2>
            <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.guidelines_text")}</p>
            <GuidelinesBox label={t("app.legal.guidelines_meta")}><DocView doc={guidelines.doc} /></GuidelinesBox>
            <GuidelinesAgree version={guidelines.version} />
          </section>
        ) : (
          <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2 lg:items-start">
            <section aria-labelledby="log-h" className="panel flex flex-col gap-3 p-5">
              <h2 id="log-h" className="m-0 font-display text-2xl">{t("app.desk.log_title")}</h2>
              <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.log_text")}</p>
              <a className="btn-gold" href="/desk/log">{t("app.desk.log_open")}</a>
            </section>
            <section aria-labelledby="req-h" className="panel flex flex-col gap-3 p-5">
              <h2 id="req-h" className="m-0 font-display text-2xl">{t("app.desk.requests_title")}</h2>
              <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.requests_text")}</p>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}
