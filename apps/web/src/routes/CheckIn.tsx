import { CardFace } from "@astro/ui";
import { useParams } from "react-router";
import { CheckInForm } from "@/components/check-in/CheckInForm";
import type { DueCheckIn } from "@astro/app-core/check-ins";
import { describe } from "@/lib/draw/describe";
import { Failed, Loading, useData } from "../data";
import { useMeaning } from "../meaning";
import { useSession, useTitle } from "../session";
import { formatDate } from "@astro/copy/dates";

// Ported from apps/app/app/check-in/[id]/page.tsx (same markup); data from GET /api/check-in/:id.
export default function CheckInPage() {
  const { id = "" } = useParams();
  const { t: tr, user } = useSession();
  const meaningOf = useMeaning();
  useTitle(tr("app.check_in.meta"));
  const { data, error } = useData<Omit<DueCheckIn, "completedAt"> & { completedAt: string }>(`/api/check-in/${encodeURIComponent(id)}`);
  if (error) return <Failed error={error} />;
  if (!data) return <Loading />;
  const due = { ...data, completedAt: new Date(data.completedAt) };
  const t = describe(due.cardId, due.orientation, tr, meaningOf);
  const when = formatDate(due.completedAt, user?.timeZone ?? "UTC");

  return (
    <div data-page className="flex flex-col gap-6">
      <div className="flex items-center gap-4 lg:gap-6">
        <div className="flex-none"><CardFace id={due.cardId} size="sm" reversed={t.reversed} reversedLabel={tr("app.card.reversed")} /></div>
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{tr("app.check_in.eyebrow", { date: when })}</p>
          <h1 className="m-0 font-display text-3xl font-medium leading-tight">{tr("app.check_in.title", { card: t.card.name })}</h1>
          <p className="m-0 text-sm leading-relaxed text-haze">{due.position === "present" ? `${tr("app.check_in.present_position")} ` : ""}“{t.side.summary}.”</p>
        </div>
      </div>
      <CheckInForm sessionId={due.sessionId} />
    </div>
  );
}
