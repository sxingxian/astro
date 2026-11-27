import { AuthShell } from "@/components/AuthShell";
import { ResetForm } from "@/components/ResetForm";
import { getCopy } from "@/lib/copy";

export async function generateMetadata() {
  return { title: (await getCopy())("app.reset.meta") };
}

export default async function ResetPage({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  const t = await getCopy();
  if (!token || error)
    return (
      <AuthShell title={t("app.reset.expired_title")} lede={t("app.reset.expired_lede")} footer={<a href="/sign-in">{t("app.common.back_to_sign_in")}</a>}>
        <a className="btn-gold" href="/forgot-password">{t("app.reset.send_new")}</a>
      </AuthShell>
    );
  return (
    <AuthShell title={t("app.reset.title")} lede={t("app.reset.lede")}>
      <ResetForm token={token} />
    </AuthShell>
  );
}
