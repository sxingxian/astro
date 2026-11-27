import { getCopy } from "@/lib/copy";
import { DrawOne } from "@/components/draw/DrawOne";
import { getEnv } from "@/lib/env";

export async function generateMetadata() {
  return { title: (await getCopy())("app.draw.one_meta") };
}

export default async function DrawOnePage() {
  const env = getEnv();
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pb-16 pt-8">
      <a href="/today" className="px-5 text-sm">{(await getCopy())("app.draw.back_today")}</a>
      <DrawOne mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </div>
  );
}
