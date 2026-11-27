import { LogWorkspace } from "@/components/reader-log/LogWorkspace";
import { getCopy } from "@/lib/copy";
import { requireReaderPage } from "@/lib/reader-page";

export async function generateMetadata() {
  return { title: (await getCopy())("app.log.meta") };
}
export const dynamic = "force-dynamic";

/** My log: the reader's own outside readings, newest first (with the record form beside them on desktop). */
export default async function LogPage({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const user = await requireReaderPage();
  const [t, { after }] = await Promise.all([getCopy(), searchParams]);
  return <LogWorkspace user={user} t={t} mode="list" after={after ?? null} />;
}
