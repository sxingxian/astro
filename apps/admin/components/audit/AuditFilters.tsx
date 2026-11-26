"use client";

import { AUDIT_GROUPS } from "@/lib/audit-groups";
import type { AuditQuery } from "@/lib/audit-view";

/** A plain GET form, so filters live in the address bar and can be shared. It applies as soon as a value changes. */
export function AuditFilters({ query, people }: { query: AuditQuery; people: { id: string; email: string }[] }) {
  const apply = (e: React.ChangeEvent<HTMLSelectElement | HTMLInputElement>) => e.currentTarget.form?.requestSubmit();
  return (
    <form method="get" className="grid gap-3 items-end grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
      <label className="field">
        Person
        <select name="actor" className="input" defaultValue={query.actor ?? ""} onChange={apply}>
          <option value="">Everyone</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.email}</option>)}
        </select>
      </label>
      <label className="field">
        Action
        <select name="group" className="input" defaultValue={query.group ?? ""} onChange={apply}>
          <option value="">All actions</option>
          {Object.entries(AUDIT_GROUPS).map(([k, g]) => <option key={k} value={k}>{g.label}</option>)}
        </select>
      </label>
      <label className="field">From<input name="from" type="date" className="input" defaultValue={query.from} onChange={apply} /></label>
      <label className="field">To<input name="to" type="date" className="input" defaultValue={query.to} onChange={apply} /></label>
      <noscript><button type="submit" className="btn">Apply</button></noscript>
    </form>
  );
}
