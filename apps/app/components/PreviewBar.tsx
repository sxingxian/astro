"use client";

import { usePathname } from "next/navigation";
import { useT } from "./CopyProvider";

/** Shown on pages opened with a valid ?astro-preview= link from the admin portal. */
export function PreviewBar() {
  const t = useT();
  const path = usePathname();
  return (
    <div role="status" className="sticky top-0 z-50 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-gold px-4 py-2 text-center text-sm text-night">
      <strong className="font-semibold">{t("app.preview.bar")}</strong>
      <span>{t("app.preview.note")}</span>
      <a href={path} className="font-semibold text-night underline underline-offset-2">{t("app.preview.exit")}</a>
    </div>
  );
}
