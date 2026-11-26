import { ForgotForm } from "@/components/ForgotForm";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  const env = getEnv();
  return <ForgotForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />;
}
