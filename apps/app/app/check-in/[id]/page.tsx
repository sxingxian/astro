import { CardFace } from "@astro/ui";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { CheckInForm } from "@/components/check-in/CheckInForm";
import { getSessionUser } from "@/lib/auth";
import { findDue } from "@/lib/check-ins";
import { getDb } from "@/lib/db";
import { describe } from "@/lib/draw/describe";

export const metadata = { title: "7-day check-in" };

export default async function CheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser(await headers());
  if (!user) redirect("/sign-in");
  const { id } = await params;
  const due = await findDue(getDb(), user.id, id);
  if (!due) notFound();
  const t = describe(due.cardId, due.orientation);
  const when = due.completedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: user.timeZone });

  return (
    <div className="mx-auto flex min-h-dvh max-w-[560px] flex-col gap-6 px-5 pb-10 pt-6">
      <a href="/today" className="text-sm">← Today</a>
      <div className="flex items-center gap-4">
        <CardFace id={due.cardId} size="sm" reversed={t.reversed} />
        <div className="flex flex-col gap-1.5">
          <p className="eyebrow">7-day check-in · {when}</p>
          <h1 className="m-0 font-display text-3xl font-medium leading-tight">A week ago you drew {t.card.name}</h1>
          <p className="m-0 text-sm leading-relaxed text-haze">{due.position === "present" ? "Present, in your three pairs. " : ""}“{t.side.summary}.”</p>
        </div>
      </div>
      <CheckInForm sessionId={due.sessionId} />
    </div>
  );
}
