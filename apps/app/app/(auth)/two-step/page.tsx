import { AuthShell } from "@/components/AuthShell";
import { TwoStepChallenge } from "@/components/TwoStepChallenge";
import { getCopy } from "@/lib/copy";

export async function generateMetadata() {
  return { title: (await getCopy())("app.two_step.meta") };
}

export default async function TwoStepPage() {
  const t = await getCopy();
  return (
    <AuthShell title={t("app.two_step.title")} lede={t("app.two_step.lede")} footer={<a href="/sign-in">{t("app.two_step.start_again")}</a>}>
      <TwoStepChallenge />
    </AuthShell>
  );
}
