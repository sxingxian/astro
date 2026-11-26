import { AuthShell } from "@/components/AuthShell";
import { SignUpForm } from "@/components/SignUpForm";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Create your account" };

export default function SignUpPage() {
  const env = getEnv();
  return (
    <AuthShell
      title="Create your free account"
      lede="Unlock the three-pair spread and keep every reading in your journal."
      footer={
        <div className="flex flex-col gap-3">
          <span>Already have an account? <a href="/sign-in">Sign in</a></span>
          <span className="text-muted">We'll email a link to verify your address. You can turn on 2-step sign-in any time in Account.</span>
        </div>
      }
    >
      <SignUpForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthShell>
  );
}
