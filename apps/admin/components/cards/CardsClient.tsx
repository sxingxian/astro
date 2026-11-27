"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "../FormError";
import { StepUpDialog } from "../StepUpDialog";
import { changes, checkText, textError } from "../text/shared";
import { HistoryPanel, LivePanel, type Live, type Version } from "../text/VersionPanels";
import { postJson } from "@/lib/client";

export interface CardRow {
  id: string;
  name: string;
  numeral: string;
  group: string;
  draft: boolean;
}
export interface Field {
  key: string;
  field: string;
  label: string;
  max: number;
  default: string;
  draft: string | null;
  live: string | null;
}

interface Props {
  cards: CardRow[];
  group: string;
  card: { id: string; name: string; numeral: string };
  fields: Field[];
  pending: { key: string; title: string }[];
  live: Live | null;
  history: Version[];
  canEdit: boolean;
}

const GROUPS = [
  { id: "majors", label: "Majors" },
  { id: "wands", label: "Wands" },
  { id: "cups", label: "Cups" },
  { id: "swords", label: "Swords" },
  { id: "pentacles", label: "Pentacles" }
];

/** How each field is named in the editor ("Default summary" / "Your summary"). */
const NOUN: Record<string, string> = {
  "upright.summary": "summary",
  "upright.body": "meaning",
  "reversed.summary": "summary",
  "reversed.body": "meaning",
  as_theme: "text as the theme",
  as_clarifier: "text as the clarifier",
  "positions.past": "text in the past position",
  "positions.present": "text in the present position",
  "positions.future": "text in the future position"
};

const current = (f: Field) => f.draft ?? f.live ?? f.default;
const cardTitle = (c: { numeral: string; name: string }) => (c.numeral ? `${c.numeral} · ${c.name}` : c.name);

export function CardsClient({ cards, group, card, fields, pending, live, history, canEdit }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f.key, current(f)])));
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  const q = query.trim().toLowerCase();
  const shown = q ? cards.filter((c) => c.name.toLowerCase().includes(q)) : cards.filter((c) => c.group === group);
  const edited = fields.filter((f) => values[f.key] !== current(f));
  const invalid = edited.find((f) => {
    const v = values[f.key] ?? "";
    return v.trim() !== "" && v !== f.default && !checkText(v, f.max, [], f.default.includes("\n")).ok;
  });

  async function save() {
    setBusy(true);
    setNotice(null);
    setError(null);
    for (const f of edited) {
      const v = values[f.key] ?? "";
      // An empty field, or the default typed back in, means "use the default".
      const res = v.trim() === "" || v === f.default ? await postJson("/api/text/draft", { key: f.key, useDefault: true }) : await postJson("/api/text/draft", { key: f.key, value: v });
      if (!res.ok) {
        setBusy(false);
        return setError(`${f.label}: ${textError(res)}`);
      }
    }
    setBusy(false);
    setNotice("Draft saved. Publish when you're ready.");
    router.refresh();
  }

  async function publish(code: string): Promise<string | null> {
    const res = await postJson<{ version: number }>("/api/text/publish", { kind: "meanings", note: "", code });
    if (res.data.error?.startsWith("step_up_")) return res.data.error;
    setPublishing(false);
    if (!res.ok) setError(textError(res));
    else setNotice(`Published version ${res.data.version}. The app shows it within a minute.`);
    router.refresh();
    return null;
  }

  const sections = [
    { id: "upright", title: `${card.name} · upright`, keys: ["upright.summary", "upright.body"] },
    { id: "reversed", title: `${card.name} · reversed`, keys: ["reversed.summary", "reversed.body"] },
    { id: "spread", title: "In a three-card spread", keys: ["as_theme", "as_clarifier", "positions.past", "positions.present", "positions.future"] }
  ];

  return (
    <div className="flex flex-col gap-5">
      {canEdit ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <button type="button" className="btn" disabled={busy || edited.length === 0 || Boolean(invalid)} onClick={save}>Save draft</button>
          <button type="button" className="btn btn-gold" disabled={busy || pending.length === 0} onClick={() => { setError(null); setPublishing(true); }}>
            {pending.length ? `Publish ${changes(pending.length)}` : "Nothing to publish"}
          </button>
          {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
          <FormError message={error ?? (invalid ? `${invalid.label}: check the length, and use plain text (line breaks only in the meanings).` : null)} />
        </div>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section className="panel flex max-w-[280px] flex-[1_1_240px] flex-col gap-3 p-4" aria-label="Cards">
          <label className="field">
            Find a card
            <input className="input" type="search" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <nav aria-label="Card groups" className="flex flex-wrap gap-1.5">
            {GROUPS.map((g) => (
              <Link
                key={g.id}
                href={`/cards?group=${g.id}`}
                aria-current={g.id === group && !q ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-3 text-[13px] no-underline ${g.id === group && !q ? "border-nebula bg-nebula text-moon" : "border-gold/25 text-haze"}`}
              >
                {g.label}
              </Link>
            ))}
          </nav>
          <ul className="m-0 flex max-h-[60vh] list-none flex-col gap-0.5 overflow-y-auto p-0">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/cards?card=${c.id}&group=${c.group}`}
                  aria-current={c.id === card.id ? "true" : undefined}
                  className={`flex min-h-11 items-center justify-between gap-2 rounded-[10px] px-3 text-sm no-underline ${c.id === card.id ? "bg-nebula text-moon" : "text-haze"}`}
                >
                  <span>{cardTitle(c)}</span>
                  {c.draft ? <span className="text-[11px] text-gold">Draft</span> : null}
                </Link>
              </li>
            ))}
          </ul>
          <p className="m-0 text-xs leading-normal text-muted">{cards.length} cards · {changes(pending.length)} waiting to publish</p>
        </section>

        <div className="flex min-w-0 flex-[999_1_460px] flex-col gap-5">
          {sections.map((s) => {
            const list = s.keys.map((k) => fields.find((f) => f.field === k)).filter((f): f is Field => Boolean(f));
            return (
              <section key={s.id} className="panel flex flex-col gap-3.5 p-5" aria-labelledby={`sec-${s.id}`}>
                <h2 id={`sec-${s.id}`} className={s.id === "spread" ? "m-0 text-base font-semibold" : "serif m-0 text-[28px] font-semibold"}>{s.title}</h2>
                {list.map((f) => {
                  const noun = NOUN[f.field] ?? f.label;
                  const v = values[f.key] ?? "";
                  const long = f.max > 500;
                  return (
                    <div key={f.key} className="grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-4">
                      <div className="flex flex-col gap-1.5">
                        <span className="label">Default {noun}</span>
                        <p className="m-0 whitespace-pre-wrap rounded-[10px] bg-deep px-3.5 py-3 text-sm leading-relaxed text-muted">{f.default}</p>
                      </div>
                      {canEdit ? (
                        <label className="field">
                          Your {noun}
                          <textarea className="input resize-y text-sm leading-relaxed" rows={long ? 8 : 2} value={v} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                          <span className={`text-xs ${v.length > f.max ? "text-[#F0A0A0]" : "text-muted"}`}>{v.length} of {f.max} characters{v === f.default ? " · same as the default" : ""}</span>
                        </label>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          <span className="label">In use</span>
                          <p className="m-0 whitespace-pre-wrap rounded-[10px] bg-deep px-3.5 py-3 text-sm leading-relaxed text-haze">{f.live ?? "Using the default"}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            );
          })}
        </div>

        <aside className="flex max-w-[300px] flex-[1_1_260px] flex-col gap-5">
          <section className="panel flex flex-col gap-3 p-5" aria-labelledby="ready-h">
            <h2 id="ready-h" className="m-0 text-base font-semibold">Ready to publish</h2>
            {pending.length ? (
              <ul className="m-0 pl-[18px] text-sm leading-[1.8] text-haze">{pending.map((p) => <li key={p.key}>{p.title}</li>)}</ul>
            ) : (
              <p className="m-0 text-sm text-muted">No changes waiting.</p>
            )}
            <p className="m-0 text-[13px] leading-relaxed text-muted">
              {canEdit ? "Card meanings are read live by the app, so a publish shows within a minute. Publishing asks for your authenticator code." : "Only the owner can change and publish card meanings."}
            </p>
          </section>
          <LivePanel live={live} />
          <HistoryPanel versions={history} liveId={live?.id ?? null} canRestore={canEdit} />
        </aside>
      </div>

      {canEdit ? (
        <StepUpDialog open={publishing} description={`Publish ${changes(pending.length)} to card meanings? The app shows them within a minute.`} confirmLabel="Publish" onConfirm={publish} onCancel={() => setPublishing(false)} />
      ) : null}
    </div>
  );
}
