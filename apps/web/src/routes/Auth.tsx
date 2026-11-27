import { AuthShell } from "@/components/AuthShell";
import { ForgotForm } from "@/components/ForgotForm";
import { ResetForm } from "@/components/ResetForm";
import { SignInForm } from "@/components/SignInForm";
import { SignUpForm } from "@/components/SignUpForm";
import { TwoStepChallenge } from "@/components/TwoStepChallenge";
import { useSession, useTitle } from "../session";

// Ported from apps/app/app/(auth)/*/page.tsx (same markup). The Turnstile settings come from the session.

export function SignInPage() {
  const { t, config } = useSession();
  useTitle(t("app.sign_in.meta"));
  return (
    <AuthShell
      title={t("app.sign_in.title")}
      footer={
        <div className="flex flex-col gap-3">
          <a href="/forgot-password">{t("app.sign_in.forgot")}</a>
          <span>
            {t("app.sign_in.new_here")} <a href="/sign-up">{t("app.sign_in.create_link")}</a>
          </span>
        </div>
      }
    >
      <SignInForm mode={config.turnstileMode} siteKey={config.turnstileSiteKey} />
    </AuthShell>
  );
}

export function SignUpPage() {
  const { t, config } = useSession();
  useTitle(t("app.sign_up.meta"));
  return <SignUpForm mode={config.turnstileMode} siteKey={config.turnstileSiteKey} />;
}

export function ForgotPage() {
  const { t, config } = useSession();
  useTitle(t("app.forgot.meta"));
  return <ForgotForm mode={config.turnstileMode} siteKey={config.turnstileSiteKey} />;
}

export function ResetPage() {
  const { t } = useSession();
  useTitle(t("app.reset.meta"));
  const sp = new URLSearchParams(window.location.search);
  const token = sp.get("token");
  if (!token || sp.get("error"))
    return (
      <AuthShell title={t("app.reset.expired_title")} lede={t("app.reset.expired_lede")} footer={<a href="/sign-in">{t("app.common.back_to_sign_in")}</a>}>
        <a className="btn-gold" href="/forgot-password">
          {t("app.reset.send_new")}
        </a>
      </AuthShell>
    );
  return (
    <AuthShell title={t("app.reset.title")} lede={t("app.reset.lede")}>
      <ResetForm token={token} />
    </AuthShell>
  );
}

export function TwoStepPage() {
  const { t } = useSession();
  useTitle(t("app.two_step.meta"));
  return (
    <AuthShell title={t("app.two_step.title")} lede={t("app.two_step.lede")} footer={<a href="/sign-in">{t("app.two_step.start_again")}</a>}>
      <TwoStepChallenge />
    </AuthShell>
  );
}
