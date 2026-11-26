import { SignUpForm } from "@/components/SignUpForm";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  const env = getEnv();
  return <SignUpForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />;
}
