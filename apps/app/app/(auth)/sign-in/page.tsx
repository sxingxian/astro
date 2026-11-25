import { AuthShell } from "@/components/AuthShell";
import { SignInForm } from "@/components/SignInForm";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  const env = getEnv();
  return (
    <AuthShell
      title="Welcome back"
      footer={
        <div className="flex flex-col gap-3">
          <a href="/forgot-password">Forgot your password?</a>
          <span>New to Astro? <a href="/sign-up">Create a free account</a></span>
        </div>
      }
    >
      <SignInForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthShell>
  );
}
