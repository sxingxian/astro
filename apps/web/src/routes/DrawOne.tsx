import { DrawOne } from "@/components/draw/DrawOne";
import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/app/draw/one/page.tsx.
export default function DrawOnePage() {
  const { t, config } = useSession();
  useTitle(t("app.draw.one_meta"));
  return (
    <AppShell current="today">
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 pb-28 pt-5 lg:max-w-none lg:pb-16 lg:pt-2">
        <DrawOne mode={config.turnstileMode} siteKey={config.turnstileSiteKey} />
      </div>
    </AppShell>
  );
}
