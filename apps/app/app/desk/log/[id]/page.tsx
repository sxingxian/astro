import { HttpError } from "@astro/server";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { LogForm } from "@/components/reader-log/LogForm";
import { LogFormFrame } from "@/components/reader-log/LogFormFrame";
import { getCopy } from "@/lib/copy";
import { getDb } from "@/lib/db";
import { formValue } from "@/lib/log-form";
import { getEntry } from "@/lib/reader-log";
import { requireReaderPage } from "@/lib/reader-page";

export async function generateMetadata() {
  return { title: (await getCopy())("app.log.edit_title") };
}
export const dynamic = "force-dynamic";

export default async function EditLogEntryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireReaderPage();
  const [t, { id }] = await Promise.all([getCopy(), params]);
  const entry = await getEntry(getDb(), user.id, id).catch((e: unknown) => {
    if (e instanceof HttpError && e.status === 404) notFound();
    throw e;
  });
  return (
    <AppShell current="desk" reader>
      <LogFormFrame title={t("app.log.edit_title")} t={t}>
        <LogForm initial={formValue(t, entry.readOn, entry)} />
      </LogFormFrame>
    </AppShell>
  );
}
