import { LogWorkspace } from "@/components/reader-log/LogWorkspace";
import { getCopy } from "@/lib/copy";
import { requireReaderPage } from "@/lib/reader-page";

export async function generateMetadata() {
  return { title: (await getCopy())("app.log.new_title") };
}
export const dynamic = "force-dynamic";

export default async function NewLogEntryPage() {
  const user = await requireReaderPage();
  return <LogWorkspace user={user} t={await getCopy()} mode="new" />;
}
