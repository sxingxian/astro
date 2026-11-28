import { DrawThree } from "@/components/draw/DrawThree";
import { useSession, useTitle } from "../session";

// Ported from apps/app/app/draw/three/page.tsx.
export default function DrawThreePage() {
  const { t, user } = useSession();
  useTitle(t("app.draw.three_meta"));
  if (!user) {
    window.location.replace("/sign-up");
    return null;
  }
  return (
      <div data-page className="-mx-5 flex flex-col gap-4 lg:mx-0">
        <DrawThree />
      </div>
  );
}
