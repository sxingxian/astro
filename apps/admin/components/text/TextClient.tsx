"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { FormError } from "../FormError";
import { changes, checkText, textError } from "./shared";
import { HistoryPanel, LivePanel, type Live, type Version } from "./VersionPanels";
import { postJson } from "@/lib/client";

type Tab = "landing" | "app" | "email";

export interface Item {
  key: string;
  group: string;
  label: string;
  where: string;
  default: string;
  max: number;
  placeholders: readonly string[];
  draft: string | null;
  live: string | null;
}

interface Props {
  tab: Tab;
  items: Item[];
  pending: { key: string; title: string }[];
  live: Live | null;
  history: Version[];
  appUrl: string;
}

/** Where "Preview in the app" opens, by catalogue group. Everything else opens Today. */
const PREVIEW_PATH: Record<string, string> = {
  "Sign in": "/sign-in",
  "2-step sign-in": "/sign-in",
  "Create account": "/sign-up",
  "Password strength": "/sign-up",
  "Reset password": "/forgot-password",
  Journal: "/journal",
  Patterns: "/journal/patterns",
  Account: "/account",
  "2-step setup": "/account",
  "Team invitation": "/invite"
};

const current = (i: Item) => i.draft ?? i.live ?? i.default;
const matches = (i: Item, q: string) => [i.label, i.group, i.default, i.draft ?? "", i.live ?? ""].some((s) => s.toLowerCase().includes(q));

export function TextClient({ tab, items, pending, live, history, appUrl }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string>(items[0]?.key ?? "");
  const item = items.find((i) => i.key === selected) ?? items[0];
  const [value, setValue] = useState(item ? current(item) : "");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [published, setPublished] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);

  const pendingKeys = useMemo(() => new Set(pending.map((p) => p.key)), [pending]);
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const map = new Map<string, Item[]>();
    for (const i of items) if (!q || matches(i, q)) map.set(i.group, [...(map.get(i.group) ?? []), i]);
    return [...map];
  }, [items, query]);

  if (!item) return null;
  const multiline = item.default.includes("\n");
  const check = checkText(value, item.max, item.placeholders, multiline);

  function pick(i: Item) {
    setSelected(i.key);
    setValue(current(i));
    setNotice(null);
    setError(null);
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setNotice(null);
    setError(null);
    await fn();
    setBusy(false);
  }

  const save = () =>
    run(async () => {
      const res = await postJson("/api/text/draft", { key: item.key, value });
      if (!res.ok) return setError(textError(res));
      setNotice("Draft saved. Publish when you're ready.");
      router.refresh();
    });

  const useDefault = () =>
    run(async () => {
      const res = await postJson("/api/text/draft", { key: item.key, useDefault: true });
      if (!res.ok) return setError(textError(res));
      setValue(item.default);
      setNotice("Back to the default. Publish to make it live.");
      router.refresh();
    });

  const preview = () =>
    run(async () => {
      if (value !== current(item) && check.ok) {
        const saved = await postJson("/api/text/draft", { key: item.key, value });
        if (!saved.ok) return setError(textError(saved));
      }
      const res = await postJson<{ id: string }>("/api/text/preview", { kind: "app" });
      if (!res.ok) return setError(textError(res));
      const path = PREVIEW_PATH[item.group] ?? "/today";
      window.open(`${appUrl}${path}?astro-preview=${encodeURIComponent(res.data.id)}`, "_blank", "noopener,noreferrer");
      setNotice("Preview opened in a new tab. It shows your saved drafts for 30 minutes.");
      router.refresh();
    });

  async function publish() {
    setBusy(true);
    setPublished(null);
    setPublishError(null);
    const res = await postJson<{ version: number; rebuild: { status: number } | null }>("/api/text/publish", { kind: tab === "landing" ? "landing" : "app", note });
    setBusy(false);
    if (!res.ok) return setPublishError(textError(res));
    const status = res.data.rebuild?.status;
    setPublished(
      tab !== "landing"
        ? `Published version ${res.data.version}. It's live within a minute.`
        : status && status >= 200 && status < 300
          ? `Published version ${res.data.version}. The landing page is rebuilding; it's usually live in about 5 minutes.`
          : `Published version ${res.data.version}, but the rebuild didn't start. Publish again in 2 minutes, or start a build in the Cloudflare dashboard.`
    );
    setNote("");
    router.refresh();
  }

  const publishTitle = tab === "landing" ? "Publish the landing page" : "Publish the app and emails";

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className="panel flex max-w-[300px] flex-[1_1_250px] flex-col gap-3 p-4" aria-label="Text to edit">
        <label className="field">
          Search the wording
          <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
        <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto">
          {groups.length === 0 ? <p className="m-0 text-[13px] text-muted">Nothing matches.</p> : null}
          {groups.map(([group, list]) => (
            <div key={group} role="group" aria-label={group} className="flex flex-col gap-0.5">
              <span className="label px-1 pb-1">{group}</span>
              {list.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  aria-pressed={i.key === item.key}
                  onClick={() => pick(i)}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-[10px] px-3 text-left text-sm ${i.key === item.key ? "bg-nebula text-moon" : "text-haze"}`}
                >
                  <span>{i.label}</span>
                  {pendingKeys.has(i.key) ? <span className="pill">Draft</span> : null}
                </button>
              ))}
            </div>
          ))}
        </div>
      </section>

      <div className="flex min-w-0 flex-[999_1_420px] flex-col gap-5">
        <section className="panel flex flex-col gap-4 p-5" aria-labelledby="editor-h">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="editor-h" className="m-0 text-base font-semibold">{item.label} · {item.group}</h2>
            <span className="text-[13px] text-muted">{item.where}</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label">Default</span>
            <p className="m-0 whitespace-pre-wrap rounded-[10px] bg-deep px-3.5 py-3 text-[15px] text-muted">{item.default}</p>
          </div>
          <label className="field">
            {multiline ? "Your text (a new line starts a new line)" : "Your text"}
            <textarea className="input min-h-24 resize-y text-base" rows={multiline ? 3 : 2} value={value} onChange={(e) => setValue(e.target.value)} aria-describedby="text-checks" />
          </label>
          <ul id="text-checks" className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-[13px] text-haze">
            <li className={check.tooLong ? "text-[#F0A0A0]" : undefined}>
              <span aria-hidden="true">{check.tooLong ? "✗" : "✓"}</span> {check.length} of {item.max} characters
            </li>
            <li className={check.plain ? undefined : "text-[#F0A0A0]"}>
              <span aria-hidden="true">{check.plain ? "✓" : "✗"}</span> {multiline ? "Plain text only" : "Plain text on one line"}
            </li>
            <li className={check.missing.length || check.extra.length ? "text-[#F0A0A0]" : undefined}>
              <span aria-hidden="true">{check.missing.length || check.extra.length ? "✗" : "✓"}</span>{" "}
              {item.placeholders.length === 0 && check.extra.length === 0
                ? "No placeholders needed"
                : check.missing.length
                  ? `Keep ${check.missing.map((p) => `{${p}}`).join(", ")}`
                  : check.extra.length
                    ? `Remove ${check.extra.map((p) => `{${p}}`).join(", ")}`
                    : `Keeps ${item.placeholders.map((p) => `{${p}}`).join(", ")}`}
            </li>
          </ul>
          {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
          <FormError message={error} />
          <div className="flex flex-wrap gap-2.5">
            <button type="button" className="btn" disabled={busy || (item.draft === null && item.live === null && value === item.default)} onClick={useDefault}>Use default</button>
            <button type="button" className="btn" disabled={busy || !check.ok} onClick={save}>Save draft</button>
            {tab === "app" ? <button type="button" className="btn" disabled={busy} onClick={preview}>Preview in the app</button> : null}
          </div>
        </section>

        {tab === "landing" ? (
          <section className="panel flex flex-col gap-3.5 p-5" aria-labelledby="preview-h">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="preview-h" className="m-0 text-base font-semibold">How it will read</h2>
              <span className="text-[13px] text-muted">A simple version of the section, not the live page</span>
            </div>
            <div className="flex flex-wrap items-start gap-4">
              <div className="flex min-h-[200px] flex-[2_1_340px] flex-col justify-center gap-3 rounded-[14px] bg-[radial-gradient(circle_at_70%_30%,#2A2350,#0B0B14_70%)] p-8">
                <span className="text-[11px] uppercase tracking-[0.1em] text-gold">{item.group} · desktop</span>
                <span className="serif whitespace-pre-wrap text-[40px] leading-[1.05]">{value}</span>
              </div>
              <div className="flex min-h-[200px] flex-[0_0_180px] flex-col justify-center gap-2 rounded-[18px] border border-gold/20 bg-night px-4 py-5">
                <span className="text-[10px] uppercase tracking-[0.1em] text-gold">Phone</span>
                <span className="serif whitespace-pre-wrap break-words text-[26px] leading-[1.05]">{value}</span>
              </div>
            </div>
          </section>
        ) : null}
      </div>

      <aside className="flex max-w-[320px] flex-[1_1_280px] flex-col gap-5">
        <section className="panel flex flex-col gap-3.5 p-5" aria-labelledby="publish-h">
          <h2 id="publish-h" className="m-0 text-base font-semibold">{publishTitle}</h2>
          {pending.length ? (
            <ul className="m-0 pl-[18px] text-sm leading-[1.8] text-haze">
              {pending.map((p) => <li key={p.key}>{p.title}</li>)}
            </ul>
          ) : (
            <p className="m-0 text-sm text-muted">No changes waiting.</p>
          )}
          <label className="field">
            Note for the history (optional)
            <input className="input" maxLength={200} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn-gold" disabled={busy || pending.length === 0} onClick={publish}>
            {pending.length ? `Publish ${changes(pending.length)}` : "Nothing to publish"}
          </button>
          {published ? <p role="status" className="m-0 text-sm text-ok">{published}</p> : null}
          <FormError message={publishError} />
          <p className="m-0 text-[13px] leading-relaxed text-muted">
            {tab === "landing"
              ? "Publishing rebuilds the landing page. It's usually live in about 5 minutes. You can publish again 2 minutes after each publish."
              : "App and email wording are published together and go live within a minute. Preview in the app opens your saved drafts privately for 30 minutes."}
          </p>
        </section>
        <LivePanel live={live} landing={tab === "landing"} />
        <HistoryPanel versions={history} liveId={live?.id ?? null} canRestore />
      </aside>
    </div>
  );
}
