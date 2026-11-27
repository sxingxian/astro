import { DrawThree } from "@/components/draw/DrawThree";
import { useSession, useTitle } from "../session";
import { AppShell } from "../shell/AppShell";

// Ported from apps/app/app/draw/three/page.tsx.
export default function DrawThreePage() {
  const { t, user } = useSession();
  useTitle(t("app.draw.three_meta"));
  if (!user) {
    window.location.replace("/sign-up");
    return null;
  }
  return (
    <AppShell current="today">
      <div data-page className="mx-auto flex max-w-[560px] flex-col gap-4 pb-28 pt-5 lg:max-w-none lg:pb-16 lg:pt-2">
        <DrawThree />
      </div>
    </AppShell>
  );
}
