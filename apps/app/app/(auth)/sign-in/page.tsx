import { AuthShell } from "@/components/AuthShell";
import { SignInForm } from "@/components/SignInForm";
import { getCopy } from "@/lib/copy";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getCopy())("app.sign_in.meta") };
}

export default async function SignInPage() {
  const env = getEnv();
  const t = await getCopy();
  return (
    <AuthShell
      title={t("app.sign_in.title")}
      footer={
        <div className="flex flex-col gap-3">
          <a href="/forgot-password">{t("app.sign_in.forgot")}</a>
          <span>{t("app.sign_in.new_here")} <a href="/sign-up">{t("app.sign_in.create_link")}</a></span>
        </div>
      }
    >
      <SignInForm mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </AuthShell>
  );
}
