import { CardFace } from "@astro/ui";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckInForm } from "@/components/check-in/CheckInForm";
import { getSessionUser } from "@/lib/auth";
import { findDue } from "@/lib/check-ins";
import { getDb } from "@/lib/db";
import { describe } from "@/lib/draw/describe";
import { getCopy } from "@/lib/copy";
import { getMeanings } from "@/lib/meanings";

export async function generateMetadata() {
  return { title: (await getCopy())("app.check_in.meta") };
}

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const due = await findDue(getDb(), user.id, id);
  if (!due) notFound();
  const [tr, meaningOf] = await Promise.all([getCopy(), getMeanings()]);
  const t = describe(due.cardId, due.orientation, tr, meaningOf);
  const when = due.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: user.timeZone });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-5 pb-10 pt-6">
      <a href="/today" className="text-sm">{tr("app.draw.back_today")}</a>
      <div className="flex items-center gap-4">
        <CardFace id={due.cardId} size="sm" reversed={t.reversed} />
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">{tr("app.check_in.eyebrow", { date: when })}</p>
          <h1 className="m-0 font-display text-3xl font-medium leading-tight">{tr("app.check_in.title", { card: t.card.name })}</h1>
          <p className="m-0 text-sm leading-relaxed text-haze">{due.position === "present" ? tr("app.check_in.present_position") : ""}“{t.side.summary}.”</p>
        </div>
      </div>
      <CheckInForm sessionId={due.sessionId} />
    </div>
  );
}
