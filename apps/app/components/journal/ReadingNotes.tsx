"use client";

import { useState } from "react";
import { FormError } from "../AuthShell";
import { postJson } from "@/lib/client";

export function ReadingNotes({ sessionId, note: initialNote, isPrivate: initialPrivate }: { sessionId: string; note: string | null; isPrivate: boolean }) {
  const [note, setNote] = useState(initialNote ?? "");
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPrivate, setPrivate] = useState(initialPrivate);
  const [busy, setBusy] = useState(false);

  return (
    <section aria-labelledby="notes-h" className="panel flex flex-col gap-3 p-5">
      <h2 id="notes-h" className="eyebrow">Journal note</h2>
      <form className="flex flex-col gap-3" onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        const res = await postJson(`/api/reading/${sessionId}/note`, { body: note });
        setBusy(false);
        if (!res.ok) return setError(res.data.error === "too_long" ? "Notes can be up to 2,000 characters." : "Couldn't save your note.");
        setSaved(note.trim() ? "Note saved." : "Note removed.");
      }}>
        <label htmlFor="note" className="sr-only">Your note</label>
        <textarea id="note" rows={4} maxLength={2000} value={note} onChange={(e) => { setNote(e.target.value); setSaved(null); }} placeholder="What came up for you?" className="input min-h-28 resize-y py-3" />
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{note.length} / 2000</span>
          <button type="submit" className="btn-ghost min-h-11 px-5" disabled={busy}>Save note</button>
        </div>
        <FormError message={error} />
        {saved ? <p role="status" className="m-0 text-sm text-gold">{saved}</p> : null}
      </form>
      <label className="flex min-h-11 items-center justify-between gap-4 text-sm">
        <span>Private reading<span className="block text-muted">Left out of Patterns.</span></span>
        <input type="checkbox" role="switch" checked={isPrivate} className="size-6 accent-gold" onChange={async (e) => {
          const value = e.target.checked;
          const res = await postJson(`/api/reading/${sessionId}/private`, { value });
          if (res.ok) setPrivate(value);
        }} />
      </label>
    </section>
  );
}
