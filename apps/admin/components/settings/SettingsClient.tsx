"use client";

import { useState } from "react";
import { FormError } from "../FormError";
import { PageHeader } from "../PageHeader";
import { StepUpDialog } from "../StepUpDialog";
import { postJson } from "@/lib/client";

export interface SiteSettings {
  contact_email: string;
  reversal_rate: number;
  guest_daily_cap: number;
  disclaimer_note: string;
  social_links: string[];
  maintenance_mode: boolean;
}

/** What the form edits: numbers as typed text, the reversal rate in percent, links one per line. */
interface Draft {
  contact_email: string;
  reversal_pct: string;
  guest_daily_cap: string;
  disclaimer_note: string;
  social_links: string;
  maintenance_mode: boolean;
}

const LABELS: Record<string, string> = {
  contact_email: "Support email",
  reversal_rate: "Reversal rate (%)",
  guest_daily_cap: "Guest draws per day",
  disclaimer_note: "Reading disclaimer",
  social_links: "Social links",
  maintenance_mode: "Maintenance mode",
};

const toDraft = (s: SiteSettings): Draft => ({
  contact_email: s.contact_email,
  reversal_pct: String(Math.round(s.reversal_rate * 100)),
  guest_daily_cap: String(s.guest_daily_cap),
  disclaimer_note: s.disclaimer_note,
  social_links: s.social_links.join("\n"),
  maintenance_mode: s.maintenance_mode,
});

// Text that isn't a number stays text, so the server rejects it by name instead of it silently becoming 0.
const num = (t: string) =>
  t.trim() !== "" && Number.isFinite(Number(t)) ? Number(t) : t;
const fromDraft = (d: Draft) => ({
  contact_email: d.contact_email.trim(),
  reversal_rate:
    typeof num(d.reversal_pct) === "number"
      ? (num(d.reversal_pct) as number) / 100
      : d.reversal_pct,
  guest_daily_cap: num(d.guest_daily_cap),
  disclaimer_note: d.disclaimer_note,
  social_links: d.social_links
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean),
  maintenance_mode: d.maintenance_mode,
});

export function SettingsClient({ initial }: { initial: SiteSettings }) {
  const [saved, setSaved] = useState(initial);
  const [draft, setDraft] = useState(() => toDraft(initial));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setNotice(null);
    setDraft((d) => ({ ...d, [k]: v }));
  };

  async function send(code?: string): Promise<string | null> {
    const values = fromDraft(draft);
    const changed = Object.fromEntries(
      Object.entries(values).filter(
        ([k, v]) =>
          JSON.stringify(v) !== JSON.stringify(saved[k as keyof SiteSettings]),
      ),
    );
    if (Object.keys(changed).length === 0) {
      setNotice("Nothing to save.");
      return null;
    }
    const res = await postJson<{ fields?: string[] }>("/api/settings", {
      values: changed,
      code,
    });
    if (!res.ok) {
      if (res.data.error === "invalid_input" && res.data.fields?.length) {
        setError(
          `Check ${res.data.fields.map((f) => LABELS[f] ?? f).join(", ")}.`,
        );
        return null;
      }
      return res.data.error ?? "server_error";
    }
    setSaved({ ...saved, ...(changed as Partial<SiteSettings>) });
    setNotice("Saved.");
    setAsking(false);
    return null;
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    if (draft.maintenance_mode && !saved.maintenance_mode)
      return setAsking(true);
    setBusy(true);
    const err = await send();
    setBusy(false);
    if (err)
      setError(
        err === "forbidden"
          ? "Your role doesn't allow this."
          : "Something went wrong. Please try again.",
      );
  }

  return (
    <>
      <form onSubmit={save} className="flex flex-col gap-5" noValidate>
        <PageHeader title="Site settings">
          <button
            type="button"
            className="btn"
            onClick={() => {
              setDraft(toDraft(saved));
              setError(null);
              setNotice(null);
            }}
          >
            Discard
          </button>
          <button type="submit" className="btn btn-gold" disabled={busy}>
            Save changes
          </button>
        </PageHeader>
        <FormError message={error} />
        {notice ? (
          <p role="status" className="m-0 text-sm text-ok">
            {notice}
          </p>
        ) : null}
        <div className="grid gap-5 items-start grid-cols-[repeat(auto-fit,minmax(min(360px,100%),1fr))] max-w-[1140px]">
          <section
            className="panel p-5 flex flex-col gap-3.5"
            aria-labelledby="c-h"
          >
            <h2 id="c-h" className="m-0 text-base font-semibold">
              Contact details
            </h2>
            <label className="field">
              Support email
              <input
                className="input"
                type="email"
                value={draft.contact_email}
                onChange={(e) => set("contact_email", e.target.value)}
                maxLength={254}
              />
            </label>
            <span className="text-xs text-muted">
              Shown on the app&apos;s Help screen.
            </span>
          </section>
          <section
            className="panel p-5 flex flex-col gap-3.5"
            aria-labelledby="r-h"
          >
            <h2 id="r-h" className="m-0 text-base font-semibold">
              Reading rules
            </h2>
            <label className="field">
              Reversal rate (%)
              <input
                className="input"
                inputMode="numeric"
                value={draft.reversal_pct}
                onChange={(e) => set("reversal_pct", e.target.value)}
              />
            </label>
            <label className="field">
              Guest draws per day
              <input
                className="input"
                inputMode="numeric"
                value={draft.guest_daily_cap}
                onChange={(e) => set("guest_daily_cap", e.target.value)}
              />
            </label>
            <span className="text-xs text-muted">
              Reversal rate 0 means no reversed cards. Guest draws are counted
              per network, 1 to 20.
            </span>
          </section>
          <section
            className="panel p-5 flex flex-col gap-3.5"
            aria-labelledby="l-h"
          >
            <h2 id="l-h" className="m-0 text-base font-semibold">
              Legal and disclaimers
            </h2>
            <label className="field">
              Reading disclaimer
              <textarea
                className="input py-2.5 min-h-[96px]"
                rows={3}
                maxLength={500}
                value={draft.disclaimer_note}
                onChange={(e) => set("disclaimer_note", e.target.value)}
              />
            </label>
          </section>
          <section
            className="panel p-5 flex flex-col gap-3.5"
            aria-labelledby="s-h"
          >
            <h2 id="s-h" className="m-0 text-base font-semibold">
              Social links
            </h2>
            <label className="field">
              Social links
              <textarea
                className="input py-2.5 min-h-[96px]"
                rows={4}
                value={draft.social_links}
                onChange={(e) => set("social_links", e.target.value)}
                placeholder="https://instagram.com/…"
              />
            </label>
            <span className="text-xs text-muted">
              One https link per line, up to 6.
            </span>
          </section>
          <section
            className="panel p-5 flex flex-col gap-3.5 border-[rgba(226,109,109,.35)]"
            aria-labelledby="m-h"
          >
            <h2 id="m-h" className="m-0 text-base font-semibold">
              Maintenance mode
            </h2>
            <div className="flex items-center justify-between gap-3 min-h-11">
              <span className="text-sm">Pause the app and show a notice</span>
              <button
                type="button"
                role="switch"
                aria-checked={draft.maintenance_mode}
                aria-label="Maintenance mode"
                onClick={() => set("maintenance_mode", !draft.maintenance_mode)}
                className={`relative w-11 h-6 rounded-full border transition-colors duration-150 motion-reduce:transition-none ${draft.maintenance_mode ? "bg-gold border-gold" : "bg-transparent border-gold/40"}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 size-[18px] rounded-full transition-transform duration-150 motion-reduce:transition-none ${draft.maintenance_mode ? "translate-x-5 bg-night" : "bg-moon"}`}
                />
              </button>
            </div>
            <span className="text-xs text-muted">
              The landing page stays online. Turning this on asks for your code.
            </span>
          </section>
        </div>
      </form>
      <StepUpDialog
        open={asking}
        description="Pause the app for everyone? Enter the code from your authenticator app to continue."
        confirmLabel="Pause the app"
        onConfirm={send}
        onCancel={() => setAsking(false)}
      />
    </>
  );
}
