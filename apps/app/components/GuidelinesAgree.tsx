"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "./AuthShell";
import { useT } from "./CopyProvider";
import { postJson } from "@/lib/client";

/** Agreeing to newly published reader guidelines before using Desk. */
export function GuidelinesAgree({ version }: { version: number }) {
  const t = useT();
  const router = useRouter();
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await postJson("/api/reader/guidelines", { version });
        setBusy(false);
        if (!res.ok) {
          setAgreed(false);
          setError(t(res.data.error === "guidelines_changed" ? "app.offer.guidelines_changed" : "app.common.went_wrong"));
        }
        router.refresh();
      }}
    >
      <label className="flex items-start gap-2.5 text-sm leading-relaxed">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 size-[18px] flex-none accent-gold" />
        {t("app.offer.agree")}
      </label>
      <FormError message={error} />
      <button type="submit" className="btn-gold" disabled={!agreed || busy}>{t("app.guidelines.agree_button")}</button>
    </form>
  );
}
