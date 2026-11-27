import { ForgotForm } from "@/components/ForgotForm";
import { getCopy } from "@/lib/copy";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getCopy())("app.forgot.meta") };
}

export default function ForgotPage() {
  const env = getEnv();
  return <ForgotForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />;
}
