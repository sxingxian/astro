"use client";

import { parseDoc, type Doc } from "@astro/copy";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "../FormError";
import { textError } from "./shared";
import { HistoryPanel, LivePanel, type Live, type Version } from "./VersionPanels";
import { postJson } from "@/lib/client";
import type { LegalItem, LegalKind } from "@/lib/text";

// Loaded only on this tab, so the rest of the portal stays small.
const LegalEditor = dynamic(() => import("./LegalEditor"), { ssr: false, loading: () => <div className="ed-loading min-h-[320px]" aria-busy="true" /> });

/** Where "Preview in the app" opens each page. */
const PREVIEW_PATH: Record<LegalKind, string> = { terms: "/terms", privacy: "/privacy", guidelines: "/reader-guidelines" };

const toDoc = (json: string): Doc => {
  const r = parseDoc(json);
  return r.ok ? r.doc : { v: 1, blocks: [] };
};

export function LegalClient({ page, items, live, history, appUrl }: { page: LegalKind; items: LegalItem[]; live: Live | null; history: Version[]; appUrl: string }) {
  const router = useRouter();
  const item = items.find((i) => i.kind === page)!;
  const [doc, setDoc] = useState<Doc>(() => toDoc(item.draft ?? item.live ?? item.default));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    setError(null);
    await fn();
    setBusy(false);
  }

  const save = () =>
    run(async () => {
      const res = await postJson("/api/text/draft", { key: item.key, value: JSON.stringify(doc) });
      if (!res.ok) return setError(textError(res));
      setNotice("Draft saved. Publish when you're ready.");
      router.refresh();
    });

  const useDefault = () =>
    run(async () => {
      const res = await postJson("/api/text/draft", { key: item.key, useDefault: true });
      if (!res.ok) return setError(textError(res));
      setDoc(toDoc(item.default));
      setNotice("Back to the default. Publish to make it live.");
      router.refresh();
    });

  const preview = () =>
    run(async () => {
      const saved = await postJson("/api/text/draft", { key: item.key, value: JSON.stringify(doc) });
      if (!saved.ok) return setError(textError(saved));
      const res = await postJson<{ id: string }>("/api/text/preview", { kind: page });
      if (!res.ok) return setError(textError(res));
      window.open(`${appUrl}${PREVIEW_PATH[page]}?astro-preview=${encodeURIComponent(res.data.id)}`, "_blank", "noopener,noreferrer");
      setNotice("Preview opened in a new tab. It shows your saved draft for 30 minutes.");
      router.refresh();
    });

  async function publish() {
    setBusy(true);
    setPublished(null);
    setPublishError(null);
    const res = await postJson<{ version: number }>("/api/text/publish", { kind: page, note });
    setBusy(false);
    if (!res.ok) return setPublishError(textError(res));
    setPublished(`Published version ${res.data.version}. It's live within a minute.`);
    setNote("");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-start gap-5">
      <nav className="panel flex max-w-[300px] flex-[1_1_250px] flex-col gap-1 p-4" aria-label="Legal pages">
        <span className="label px-1 pb-1">Legal</span>
        {items.map((i) => (
          <Link key={i.kind} href={`/text?tab=legal&page=${i.kind}`} aria-current={i.kind === page ? "page" : undefined} className={`flex min-h-11 items-center justify-between gap-2 rounded-[10px] px-3 text-sm no-underline ${i.kind === page ? "bg-nebula text-moon" : "text-haze"}`}>
            <span>{i.label}</span>
            {i.pending ? <span className="pill">Draft</span> : null}
          </Link>
        ))}
      </nav>

      <section className="panel flex min-w-0 flex-[999_1_420px] flex-col gap-4 p-5" aria-labelledby="legal-h">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="legal-h" className="m-0 text-base font-semibold">{item.label} · Legal</h2>
          <span className="text-[13px] text-muted">{item.where}</span>
        </div>
        <p className="m-0 text-[13px] text-muted">Type &quot;/&quot; for blocks, or start a line with ## , - , 1. or &gt; . Select text to make it bold, italic or a link.</p>
        <div className="rounded-[12px] border border-gold/20 bg-deep px-4 py-2">
          <LegalEditor key={page} value={doc} onChange={setDoc} label={item.label} />
        </div>
        {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
        <FormError message={error} />
        <div className="flex flex-wrap gap-2.5">
          <button type="button" className="btn" disabled={busy || (item.draft === null && item.live === null)} onClick={useDefault}>Use default</button>
          <button type="button" className="btn" disabled={busy} onClick={save}>Save draft</button>
          <button type="button" className="btn" disabled={busy} onClick={preview}>Preview in the app</button>
        </div>
      </section>

      <aside className="flex max-w-[320px] flex-[1_1_280px] flex-col gap-5">
        <section className="panel flex flex-col gap-3.5 p-5" aria-labelledby="publish-h">
          <h2 id="publish-h" className="m-0 text-base font-semibold">Publish {item.label}</h2>
          <p className="m-0 text-sm text-haze">{item.pending ? "Your saved draft is ready to publish." : "No changes waiting."}</p>
          <label className="field">
            Note for the history (optional)
            <input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn-gold" disabled={busy || !item.pending} onClick={publish}>{item.pending ? "Publish 1 change" : "Nothing to publish"}</button>
          {published ? <p role="status" className="m-0 text-sm text-ok">{published}</p> : null}
          <FormError message={publishError} />
          <p className="m-0 text-[13px] leading-relaxed text-muted">Each legal page is published on its own and goes live in the app within a minute. Its &quot;Last updated&quot; date is the day you publish it.</p>
        </section>
        <LivePanel live={live} />
        <HistoryPanel versions={history} liveId={live?.id ?? null} canRestore />
      </aside>
    </div>
  );
}
