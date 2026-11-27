import { getCopy } from "@/lib/copy";
import { AppShell } from "@/components/AppShell";
import { DrawOne } from "@/components/draw/DrawOne";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getCopy())("app.draw.one_meta") };
}

export default async function DrawOnePage() {
  const env = getEnv();
  return (
    <AppShell current="today">
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 pb-28 pt-5 lg:max-w-none lg:pb-16 lg:pt-2">
        <DrawOne mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
      </div>
    </AppShell>
  );
}
