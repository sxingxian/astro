"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LocalTime } from "../audit/LocalTime";
import { FormError } from "../FormError";
import { StepUpDialog } from "../StepUpDialog";
import { textError } from "./shared";
import { postJson } from "@/lib/client";

export interface Live {
  id: number;
  publishedAt: string;
  rebuildStatus: number | null;
}
export interface Version {
  id: number;
  publishedAt: string;
  by: string | null;
  note: string | null;
}

const ok = (s: number) => s >= 200 && s < 300;

/** "Live now": the published version, and for the landing page what the last rebuild request got back. */
export function LivePanel({ live, landing }: { live: Live | null; landing?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A failed request, or none recorded (the portal stopped before it got an answer): offer to try again.
  const unconfirmed = landing && live !== null && (live.rebuildStatus === null || !ok(live.rebuildStatus));

  async function again() {
    setBusy(true);
    setMessage(null);
    setError(null);
    const res = await postJson<{ rebuild: { status: number } }>("/api/text/rebuild", {});
    setBusy(false);
    if (!res.ok) return setError(textError(res));
    if (ok(res.data.rebuild.status)) setMessage("Rebuild started. It's usually live in about 5 minutes.");
    else setError("The rebuild still didn't start. Try again in 2 minutes, or start a build in the Cloudflare dashboard.");
    router.refresh();
  }

  return (
    <section className="panel flex flex-col gap-2 px-5 py-4" aria-labelledby="live-h">
      <h2 id="live-h" className="m-0 text-base font-semibold">Live now</h2>
      {live ? (
        <>
          <span className="text-sm">Version {live.id} · published <LocalTime iso={live.publishedAt} /></span>
          {landing && live.rebuildStatus !== null && ok(live.rebuildStatus) ? (
            <span className="text-[13px] text-ok">Rebuild started · the page footer shows &quot;v{live.id}&quot; once it&apos;s live</span>
          ) : null}
          {unconfirmed ? (
            <>
              <span className="text-[13px] text-warn">
                {live.rebuildStatus === null ? "The rebuild wasn't confirmed, so this version may not be on the landing page yet." : "The rebuild didn't start, so this version isn't on the landing page yet."}
              </span>
              <button type="button" className="btn self-start" disabled={busy} onClick={again}>Start the rebuild again</button>
            </>
          ) : null}
          {message ? <p role="status" className="m-0 text-[13px] text-ok">{message}</p> : null}
          <FormError message={error} />
        </>
      ) : (
        <span className="text-sm text-muted">Nothing published yet: visitors see the default wording.</span>
      )}
    </section>
  );
}

/** Published versions, newest first. Restoring publishes an older one again and asks for an authenticator code. */
export function HistoryPanel({ versions, liveId, canRestore }: { versions: Version[]; liveId: number | null; canRestore: boolean }) {
  const router = useRouter();
  const [restoring, setRestoring] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirm(code: string): Promise<string | null> {
    if (restoring === null) return null;
    const res = await postJson("/api/text/restore", { versionId: restoring, code });
    if (res.data.error?.startsWith("step_up_")) return res.data.error;
    setRestoring(null);
    setError(res.ok ? null : textError(res));
    router.refresh();
    return null;
  }

  return (
    <section className="panel flex flex-col gap-3 px-5 py-4" aria-labelledby="history-h">
      <h2 id="history-h" className="m-0 text-base font-semibold">History</h2>
      {versions.length === 0 ? <p className="m-0 text-[13px] text-muted">No versions yet.</p> : null}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[13px]">
        {versions.map((v) => (
          <li key={v.id} className="flex items-center justify-between gap-2">
            <span>
              v{v.id} · {v.by ?? "someone"} · <LocalTime iso={v.publishedAt} />
              {v.note ? <span className="block text-muted">{v.note}</span> : null}
            </span>
            {v.id === liveId ? (
              <span className="text-muted">Live</span>
            ) : canRestore ? (
              <button type="button" className="btn min-h-11" aria-label={`Restore version ${v.id}`} onClick={() => { setError(null); setRestoring(v.id); }}>Restore</button>
            ) : null}
          </li>
        ))}
      </ul>
      <FormError message={error} />
      {canRestore ? (
        <StepUpDialog
          open={restoring !== null}
          description={`Version ${restoring ?? ""} will be published again as the newest version.`}
          confirmLabel="Restore"
          onConfirm={confirm}
          onCancel={() => setRestoring(null)}
        />
      ) : null}
    </section>
  );
}
