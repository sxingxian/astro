import { LegalPageView } from "@/components/LegalPageView";
import { getCopy } from "@/lib/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getCopy())("app.legal.guidelines_meta") };
}

/** Public, so invitees and the portal's preview can read the guidelines before accepting the reader role. */
export default function Page() {
  return <LegalPageView page="guidelines" />;
}
