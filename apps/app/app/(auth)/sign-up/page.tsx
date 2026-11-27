import { SignUpForm } from "@/components/SignUpForm";
import { getCopy } from "@/lib/copy";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getCopy())("app.sign_up.meta") };
}

export default function SignUpPage() {
  const env = getEnv();
  return <SignUpForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />;
}
