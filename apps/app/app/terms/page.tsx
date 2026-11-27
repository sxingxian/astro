import { LegalPageView } from "@/components/LegalPageView";
import { getCopy } from "@/lib/copy";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: (await getCopy())("app.legal.terms_meta") };
}

export default function Page() {
  return <LegalPageView page="terms" />;
}
