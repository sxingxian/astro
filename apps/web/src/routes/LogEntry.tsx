import { useParams } from "react-router";
import { LogForm } from "@/components/reader-log/LogForm";
import { formValue } from "@/lib/log-form";
import type { Entry } from "@astro/app-core/reader-log";
import { ApiError } from "../api";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { Lock } from "./Log";

/** Recording a new outside reading, or editing one of the reader's own (its own screen, with back to My log). */
export default function LogEntryPage() {
  const { id } = useParams();
  const { t, user } = useSession();
  useTitle(t(id ? "app.log.edit_title" : "app.log.new_title"));
  const { data: entry, error } = useData<Entry>(id ? `/api/reader/log/${encodeURIComponent(id)}` : null);
  if (error) return <Failed error={error.status === 403 ? new ApiError(404, "not_found") : error} />;
  if (id && !entry) return <Loading />;
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user?.timeZone || "UTC" });

  return (
    <div data-page className="flex max-w-[720px] flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">{t("app.desk.eyebrow")}</p>
        <h1 className="m-0 font-display text-4xl font-medium leading-tight">{t(id ? "app.log.edit_title" : "app.log.new_title")}</h1>
        <p className="m-0 flex items-center gap-2 text-sm text-haze"><Lock />{t("app.log.private")}</p>
      </header>
      <div className="panel p-5 lg:p-8">
        <LogForm key={entry?.id ?? "new"} initial={entry ? formValue(t, entry.readOn, entry) : formValue(t, today)} />
      </div>
    </div>
  );
}
