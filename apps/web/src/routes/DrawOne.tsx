import { DrawOne } from "@/components/draw/DrawOne";
import { useSession, useTitle } from "../session";

// Ported from apps/app/app/draw/one/page.tsx.
export default function DrawOnePage() {
  const { t, config } = useSession();
  useTitle(t("app.draw.one_meta"));
  return (
      <div data-page className="-mx-5 flex flex-col gap-4 lg:mx-0">
        <DrawOne mode={config.turnstileMode} siteKey={config.turnstileSiteKey} />
      </div>
  );
}
