import type { Doc } from "@astro/copy";
import { useEffect, useRef } from "react";
import { DocView } from "@/components/DocView";
import { GuidelinesAgree } from "@/components/GuidelinesAgree";
import { GuidelinesBox } from "@/components/GuidelinesBox";
import { Failed, Loading, useData } from "../data";
import { go } from "../nav";
import { useSession, useTitle } from "../session";

interface DeskData {
  accepted: boolean;
  guidelinesVersion: number;
  guidelines: { doc: Doc; version: number } | null;
}

/** The reader's Desk: My log, and a note that requests come with paid readings. Newly published guidelines come first. */
export default function DeskPage() {
  const { t, user, reload } = useSession();
  useTitle(t("app.desk.meta"));
  const { data, error } = useData<DeskData>("/api/desk");
  // Just became a reader (an offer accepted in this visit): show the Desk tab without a page load. Once only: the
  // session may still say "not a reader" for up to 5 minutes when the role was given elsewhere.
  const reloaded = useRef(false);
  useEffect(() => {
    if (!data || !user || user.reader || reloaded.current) return;
    reloaded.current = true;
    void reload();
  }, [data, user, reload]);
  // Not a reader (or no longer one): Today, as before.
  useEffect(() => {
    if (error?.status === 404) go("/today", { replace: true });
  }, [error]);
  if (error?.status === 404) return <Loading />;
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;

  return (
    <div data-page className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t("app.desk.eyebrow")}</p>
        <h1 className="m-0 font-display text-4xl font-medium leading-tight lg:text-5xl">{t("app.desk.title")}</h1>
      </header>
      {data.guidelines ? (
        <section aria-labelledby="g-h" className="panel flex max-w-[720px] flex-col gap-4 p-5 lg:p-6">
          <h2 id="g-h" className="m-0 font-display text-2xl font-medium">{t("app.desk.guidelines_title")}</h2>
          <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.guidelines_text")}</p>
          <GuidelinesBox label={t("app.legal.guidelines_meta")}>
            <DocView doc={data.guidelines.doc} />
          </GuidelinesBox>
          <GuidelinesAgree version={data.guidelines.version} />
        </section>
      ) : (
        <div className="flex flex-col gap-5 lg:grid lg:grid-cols-2">
          <section aria-labelledby="log-h" className="panel flex flex-col gap-3 p-5 lg:p-6">
            <h2 id="log-h" className="m-0 font-display text-2xl font-medium">{t("app.desk.log_title")}</h2>
            <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.log_text")}</p>
            <div className="actions mt-auto">
              <a className="btn-gold" href="/desk/log">{t("app.desk.log_open")}</a>
            </div>
          </section>
          <section aria-labelledby="req-h" className="panel flex flex-col gap-3 p-5 lg:p-6">
            <h2 id="req-h" className="m-0 font-display text-2xl font-medium">{t("app.desk.requests_title")}</h2>
            <p className="m-0 text-sm leading-relaxed text-haze">{t("app.desk.requests_text")}</p>
          </section>
        </div>
      )}
    </div>
  );
}
