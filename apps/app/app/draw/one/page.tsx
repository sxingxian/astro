import { DrawOne } from "@/components/draw/DrawOne";
import { getEnv } from "@/lib/env";

export const metadata = { title: "Today's card" };

export default function DrawOnePage() {
  const env = getEnv();
  return (
    <div className="mx-auto flex max-w-[560px] flex-col gap-6 pb-16 pt-8">
      <a href="/today" className="px-5 text-sm">← Today</a>
      <DrawOne mode={env.TURNSTILE_MODE} siteKey={env.PUBLIC_TURNSTILE_SITE_KEY} />
    </div>
  );
}
