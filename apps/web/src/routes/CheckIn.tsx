import { CardFace } from "@astro/ui";
import { useParams } from "react-router";
import { CheckInForm } from "@/components/check-in/CheckInForm";
import type { DueCheckIn } from "@/lib/check-ins";
import { describe } from "@/lib/draw/describe";
import { Failed, Loading, useData } from "../data";
import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/app/check-in/[id]/page.tsx (same markup); data from GET /api/check-in/:id.
export default function CheckInPage() {
  const { id = "" } = useParams();
  const { t: tr, meaning: meaningOf, user } = useSession();
  useTitle(tr("app.check_in.meta"));
  const { data, error } = useData<Omit<DueCheckIn, "completedAt"> & { completedAt: string }>(`/api/check-in/${encodeURIComponent(id)}`);
  if (error) return <AppShell current="today"><Failed error={error} /></AppShell>;
  if (!data) return <AppShell current="today"><Loading /></AppShell>;
  const due = { ...data, completedAt: new Date(data.completedAt) };
  const t = describe(due.cardId, due.orientation, tr, meaningOf);
  const when = due.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: user?.timeZone ?? "UTC" });

  return (
    <AppShell current="today">
    <div data-page className="mx-auto flex max-w-[560px] flex-col gap-6 px-5 pb-32 pt-6 lg:max-w-[880px] lg:px-0 lg:pb-16 lg:pt-4">
      <a href="/today" className="text-sm lg:hidden">{tr("app.draw.back_today")}</a>
      <div className="flex items-center gap-4 lg:gap-6">
        <CardFace id={due.cardId} size="sm" reversed={t.reversed} reversedLabel={tr("app.card.reversed")} />
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{tr("app.check_in.eyebrow", { date: when })}</p>
          <h1 className="m-0 font-display text-3xl font-medium leading-tight">{tr("app.check_in.title", { card: t.card.name })}</h1>
          <p className="m-0 text-sm leading-relaxed text-haze">{due.position === "present" ? tr("app.check_in.present_position") : ""}“{t.side.summary}.”</p>
        </div>
      </div>
      <CheckInForm sessionId={due.sessionId} />
    </div>
    </AppShell>
  );
}
