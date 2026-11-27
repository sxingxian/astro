import { AppShell } from "@/components/AppShell";
import { LogForm } from "@/components/reader-log/LogForm";
import { LogFormFrame } from "@/components/reader-log/LogFormFrame";
import { getCopy } from "@/lib/copy";
import { formValue } from "@/lib/log-form";
import { requireReaderPage } from "@/lib/reader-page";

export async function generateMetadata() {
  return { title: (await getCopy())("app.log.new_title") };
}
export const dynamic = "force-dynamic";

export default async function NewLogEntryPage() {
  const user = await requireReaderPage();
  const t = await getCopy();
  const today = new Date().toLocaleDateString("en-CA", { timeZone: user.timeZone || "UTC" });
  return (
    <AppShell current="desk" reader>
      <LogFormFrame title={t("app.log.new_title")} t={t}>
        <LogForm initial={formValue(t, today)} />
      </LogFormFrame>
    </AppShell>
  );
}
