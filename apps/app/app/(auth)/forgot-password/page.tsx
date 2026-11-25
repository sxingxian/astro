import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "@/components/ForgotForm";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Reset your password" };

export default function ForgotPage() {
  const env = getEnv();
  return (
    <AuthShell title="Reset your password" lede="Enter your email and we'll send you a link to choose a new password." footer={<a href="/sign-in">Back to sign in</a>}>
      <ForgotForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthShell>
  );
}
