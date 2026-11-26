"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { FormError } from "../FormError";
import { PageHeader } from "../PageHeader";
import { StepUpDialog } from "../StepUpDialog";
import { postJson } from "@/lib/client";

type Provider = "anthropic" | "openai" | "gemini" | "openai_compatible";
type Role = "writer" | "checker_1" | "checker_2";

export interface ServiceView {
  id: string;
  provider: Provider;
  name: string;
  company: string;
  baseUrl: string | null;
  model: string;
  keyLast4: string | null;
  enabled: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  cooldownUntil: string | null;
}

interface Props {
  services: ServiceView[];
  slots: { role: Role; position: number; serviceId: string }[];
  readiness: { ok: boolean; errors: string[]; warnings: string[]; companies: number };
  limits: { ai_max_tokens: number; ai_temperature: number; ai_timeout_seconds: 30 | 45 | 60; ai_daily_cap_usd: number; ai_per_person_per_day: number };
}

const ROLES: { role: Role; label: string }[] = [
  { role: "writer", label: "Writer" },
  { role: "checker_1", label: "Checker 1" },
  { role: "checker_2", label: "Checker 2" }
];
const PROVIDERS: { value: Provider; label: string }[] = [
  { value: "anthropic", label: "Anthropic" },
  { value: "openai", label: "OpenAI" },
  { value: "gemini", label: "Google Gemini" },
  { value: "openai_compatible", label: "Other service (OpenAI-compatible)" }
];
const FAILURE: Record<string, string> = { auth: "Key rejected", quota: "Credit used up", timeout: "No answer", server: "Service error", other: "Test failed" };
const KEY_ERRORS: Record<string, string> = {
  invalid_base_url: "The address must be https, on the standard port, with a real domain name.",
  invalid_input: "Check every field. Model names use letters, numbers and . _ : / - only.",
  too_many_tests: "That's 10 tests this hour. Please wait a little.",
  no_key: "This service has no key yet."
};

function roleError(code: string, services: ServiceView[]): string {
  const [kind, arg] = code.split(":");
  const role = ROLES.find((r) => r.role === arg)?.label;
  const name = services.find((s) => s.id === arg)?.name ?? "A chosen service";
  if (kind === "too_few") return `${role} needs a main service and at least 2 fallbacks.`;
  if (kind === "duplicate") return `${role} uses the same service twice.`;
  if (kind === "not_ready") return `${name} is turned off or hasn't passed a test.`;
  if (kind === "too_few_companies") return "Roles must use at least 3 different companies.";
  return "A chosen service no longer exists.";
}

function status(s: ServiceView, live?: { ok: boolean; ms: number; failure?: string; error?: string }): { text: string; detail?: string; tone: string } {
  if (live) return live.ok ? { text: `Test passed · ${(live.ms / 1000).toFixed(1)} s`, tone: "text-ok" } : { text: FAILURE[live.failure ?? "other"] ?? "Test failed", detail: live.error, tone: "text-[#F0A0A0]" };
  if (s.cooldownUntil && new Date(s.cooldownUntil) > new Date()) return { text: `Skipped until ${new Date(s.cooldownUntil).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`, tone: "text-[#E8B86A]" };
  if (!s.enabled) return { text: "Turned off", tone: "text-muted" };
  if (s.lastTestOk === true) return { text: "Test passed", tone: "text-ok" };
  if (s.lastTestOk === false) {
    const [failure, ...rest] = (s.lastError ?? "other:").split(":");
    return { text: FAILURE[failure ?? "other"] ?? "Test failed", detail: rest.join(":").trim(), tone: "text-[#F0A0A0]" };
  }
  return { text: "Not tested", tone: "text-muted" };
}

export function AiClient({ services, slots, readiness, limits }: Props) {
  const router = useRouter();
  const [live, setLive] = useState<Record<string, { ok: boolean; ms: number; failure?: string; error?: string }>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState<null | { description: string; send: (code: string) => Promise<string | null> }>(null);

  // Roles
  const initialRoles = Object.fromEntries(ROLES.map(({ role }) => {
    const ids = slots.filter((s) => s.role === role).sort((a, b) => a.position - b.position).map((s) => s.serviceId);
    return [role, ids.length >= 3 ? ids : [...ids, ...Array(3 - ids.length).fill("")]];
  })) as Record<Role, string[]>;
  const [roles, setRoles] = useState(initialRoles);
  const [roleErrors, setRoleErrors] = useState<string[]>([]);
  const setSlot = (role: Role, i: number, v: string) => setRoles((r) => ({ ...r, [role]: r[role].map((x, j) => (j === i ? v : x)) }));

  async function saveRoles() {
    setRoleErrors([]);
    const payload = ROLES.flatMap(({ role }) => roles[role].filter(Boolean).map((serviceId, position) => ({ role, position, serviceId })));
    const res = await postJson<{ errors?: string[] }>("/api/ai/roles", { slots: payload });
    if (!res.ok) return setRoleErrors(res.data.errors?.map((e) => roleError(e, services)) ?? ["Something went wrong. Please try again."]);
    setNotice("Roles saved.");
    router.refresh();
  }

  // Services
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ provider: "anthropic" as Provider, name: "", company: "", model: "", baseUrl: "", key: "" });
  const [replacing, setReplacing] = useState<{ id: string; key: string } | null>(null);

  function addService(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setAsking({
      description: `Save the key for ${draft.name || "this service"}? Enter the code from your authenticator app to continue. The owner will be emailed.`,
      send: async (code) => {
        const res = await postJson("/api/ai/service", { ...draft, baseUrl: draft.provider === "openai_compatible" ? draft.baseUrl : null, code });
        if (!res.ok) return res.data.error ?? "server_error";
        setAsking(null);
        setAdding(false);
        setDraft({ provider: "anthropic", name: "", company: "", model: "", baseUrl: "", key: "" });
        setNotice("Service saved. Test it before using it in a role.");
        router.refresh();
        return null;
      }
    });
  }

  function saveKey(e: React.FormEvent) {
    e.preventDefault();
    if (!replacing) return;
    const svc = services.find((s) => s.id === replacing.id);
    setAsking({
      description: `Replace the key for ${svc?.name}? Enter the code from your authenticator app to continue. The owner will be emailed.`,
      send: async (code) => {
        const res = await postJson("/api/ai/key", { serviceId: replacing.id, key: replacing.key, code });
        if (!res.ok) return res.data.error ?? "server_error";
        setAsking(null);
        setReplacing(null);
        setNotice("Key replaced. Test it again before it's used.");
        router.refresh();
        return null;
      }
    });
  }

  async function test(id: string) {
    setError(null);
    const res = await postJson<{ ok: boolean; ms: number; failure?: string; error?: string }>("/api/ai/test", { serviceId: id });
    if (!res.ok) return setError(KEY_ERRORS[res.data.error ?? ""] ?? "The test couldn't run. Please try again.");
    setLive((l) => ({ ...l, [id]: res.data }));
    router.refresh();
  }

  async function testAll() {
    for (const s of services) await test(s.id);
  }

  // Writing and limits
  const [lim, setLim] = useState({ ...limits, ai_daily_cap_usd: limits.ai_daily_cap_usd.toFixed(2), ai_per_person_per_day: String(limits.ai_per_person_per_day), ai_max_tokens: String(limits.ai_max_tokens) });
  async function saveLimits(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const values = {
      ai_max_tokens: Number(lim.ai_max_tokens),
      ai_temperature: Number(lim.ai_temperature),
      ai_timeout_seconds: Number(lim.ai_timeout_seconds),
      ai_daily_cap_usd: Number(lim.ai_daily_cap_usd),
      ai_per_person_per_day: Number(lim.ai_per_person_per_day)
    };
    const res = await postJson<{ fields?: string[] }>("/api/settings", { values });
    if (!res.ok) return setError(res.data.fields?.length ? "Check the writing and limit values." : "Something went wrong. Please try again.");
    setNotice("Writing and limits saved.");
  }

  const options = services.map((s) => <option key={s.id} value={s.id}>{`${s.name} · ${s.company}`}</option>);

  return (
    <div className="flex flex-col gap-5 max-w-[1140px]">
      <PageHeader title="AI settings" badge="Owner only">
        <button type="button" className="btn" onClick={testAll} disabled={services.length === 0}>Test all</button>
      </PageHeader>
      <div role="status" aria-label="Readiness" className={`flex flex-wrap gap-3 items-center px-4 py-3.5 rounded-xl border ${readiness.ok ? "border-[rgba(127,200,160,.4)]" : "border-[rgba(232,184,106,.45)]"}`}>
        <span className={`font-semibold ${readiness.ok ? "text-ok" : "text-[#E8B86A]"}`}>{readiness.ok ? "Ready" : "Not ready"}</span>
        <span className="text-sm text-haze">
          {readiness.ok
            ? `All three roles have a main service and 2 fallbacks, across ${readiness.companies} companies. AI readings switch on when paid readings launch.`
            : "Each role needs a main service and 2 fallbacks, all tested, across at least 3 companies."}
        </span>
      </div>
      {notice ? <p role="status" className="m-0 text-sm text-ok">{notice}</p> : null}
      <FormError message={error} />

      <section className="panel p-5 flex flex-col gap-3.5" aria-labelledby="how-h">
        <h2 id="how-h" className="m-0 text-base font-semibold">How every AI reading is checked</h2>
        <ol className="m-0 p-0 list-none grid gap-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))]">
          {[
            ["1 · Writer", "Writes the reading from the cards drawn and your card meanings."],
            ["2 · Checkers 1 and 2", 'Each checks it against the cards, the meanings and the safety rules. Pass, or "fix this".'],
            ["3 · If flagged", "The writer revises once and both check again. Still failing: the user isn't charged."],
            ["4 · Shown", "Only readings both checkers passed reach the user."]
          ].map(([h, t]) => (
            <li key={h} className="flex flex-col gap-1.5 p-3.5 rounded-xl border border-gold/16">
              <span className="label">{h}</span>
              <span className="text-sm leading-relaxed">{t}</span>
            </li>
          ))}
        </ol>
        <p className="m-0 text-[13px] text-muted">Each reading always uses three different companies. A fallback from a company already used in that reading is skipped.</p>
      </section>

      <section className="panel p-5 flex flex-col gap-4" aria-labelledby="roles-h">
        <div className="flex flex-col gap-1">
          <h2 id="roles-h" className="m-0 text-base font-semibold">Roles</h2>
          <span className="text-[13px] text-muted">The main service is tried first. Fallbacks are used, in order, when it times out, fails, runs out of credit or has a rejected key.</span>
        </div>
        <div className="grid gap-4 grid-cols-[repeat(auto-fit,minmax(260px,1fr))]">
          {ROLES.map(({ role, label }) => (
            <fieldset key={role} className="m-0 flex flex-col gap-2.5 p-4 rounded-2xl bg-[#0F0F1E] border border-gold/25">
              <legend className="sr-only">{label}</legend>
              <span aria-hidden="true" className="serif text-2xl font-semibold">{label}</span>
              {roles[role].map((id, i) => (
                <label key={i} className="field">
                  {i === 0 ? "Main" : `Fallback ${i}`}
                  <select className="input" value={id} onChange={(e) => setSlot(role, i, e.target.value)}>
                    <option value="">Choose a service</option>
                    {options}
                  </select>
                </label>
              ))}
              <div className="flex gap-2">
                {roles[role].length < 6 ? <button type="button" className="btn min-h-9" onClick={() => setRoles((r) => ({ ...r, [role]: [...r[role], ""] }))}>Add a fallback</button> : null}
                {roles[role].length > 3 ? <button type="button" className="btn min-h-9" onClick={() => setRoles((r) => ({ ...r, [role]: r[role].slice(0, -1) }))}>Remove the last</button> : null}
              </div>
            </fieldset>
          ))}
        </div>
        {roleErrors.length ? <div role="alert" className="error m-0">{roleErrors.map((e) => <p key={e} className="m-0">{e}</p>)}</div> : null}
        {readiness.warnings.includes("fragile") ? (
          <p className="m-0 px-3.5 py-3 rounded-[10px] bg-gold/8 text-[13px] leading-relaxed">Tip: with only three companies, one outage would pause AI readings, because each reading needs three different ones. Four or more keep readings running.</p>
        ) : null}
        <button type="button" className="btn btn-gold self-start" onClick={saveRoles}>Save roles</button>
      </section>

      <section className="panel px-2 pt-2 pb-4" aria-labelledby="svc-h">
        <div className="flex flex-wrap justify-between items-center gap-3 px-3 pt-3 pb-1">
          <h2 id="svc-h" className="m-0 text-base font-semibold">Services and keys</h2>
          <button type="button" className="btn min-h-9" onClick={() => setAdding((a) => !a)} aria-expanded={adding}>Add a service</button>
        </div>
        {adding ? (
          <form aria-label="Add a service" onSubmit={addService} className="grid gap-3 p-3 grid-cols-[repeat(auto-fit,minmax(200px,1fr))] items-end" autoComplete="off">
            <label className="field">Type<select className="input" value={draft.provider} onChange={(e) => setDraft({ ...draft, provider: e.target.value as Provider })}>{PROVIDERS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></label>
            <label className="field">Name<input className="input" required maxLength={60} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></label>
            <label className="field">Company<input className="input" required maxLength={60} value={draft.company} onChange={(e) => setDraft({ ...draft, company: e.target.value })} /></label>
            <label className="field">Model<input className="input" required maxLength={100} value={draft.model} onChange={(e) => setDraft({ ...draft, model: e.target.value })} /></label>
            {draft.provider === "openai_compatible" ? <label className="field">Address<input className="input" type="url" required placeholder="https://" value={draft.baseUrl} onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })} /></label> : null}
            <label className="field">Key<input className="input" type="password" required autoComplete="new-password" spellCheck={false} value={draft.key} onChange={(e) => setDraft({ ...draft, key: e.target.value })} /></label>
            <button type="submit" className="btn btn-gold">Save service</button>
          </form>
        ) : null}
        <div className="overflow-x-auto">
          <table className="grid min-w-[820px]">
            <thead><tr><th scope="col">Service</th><th scope="col">Company</th><th scope="col">Model</th><th scope="col">Key</th><th scope="col">Status</th><th scope="col"><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {services.map((s) => {
                const st = status(s, live[s.id]);
                return (
                  <tr key={s.id}>
                    <td>{s.name}{s.baseUrl ? <><br /><span className="text-xs text-muted">Other service · {s.baseUrl}</span></> : null}</td>
                    <td>{s.company}</td>
                    <td className="break-all">{s.model}</td>
                    <td className="font-mono text-gold">{s.keyLast4 ? `••••${s.keyLast4}` : "No key"}</td>
                    <td className={st.tone}>{st.text}{st.detail ? <><br /><span className="text-xs text-muted break-all">{st.detail}</span></> : null}</td>
                    <td>
                      <div className="flex gap-2 justify-end">
                        <button type="button" className="btn min-h-9" onClick={() => test(s.id)}>Test</button>
                        <button type="button" className="btn min-h-9" onClick={() => setReplacing({ id: s.id, key: "" })}>Replace key</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {services.length === 0 ? <tr><td colSpan={6} className="text-muted">No services yet. Add one to start.</td></tr> : null}
            </tbody>
          </table>
        </div>
        {replacing ? (
          <form aria-label="Replace key" onSubmit={saveKey} className="flex flex-wrap gap-3 items-end p-3" autoComplete="off">
            <label className="field flex-[1_1_320px]">New key for {services.find((s) => s.id === replacing.id)?.name}<input className="input" type="password" required autoComplete="new-password" spellCheck={false} value={replacing.key} onChange={(e) => setReplacing({ ...replacing, key: e.target.value })} /></label>
            <button type="submit" className="btn btn-gold">Save key</button>
            <button type="button" className="btn" onClick={() => setReplacing(null)}>Cancel</button>
          </form>
        ) : null}
        <p className="mt-2 mx-3 mb-0 text-[13px] text-muted leading-relaxed">Keys are encrypted before they&apos;re stored. Nobody can view a key again, including you: only the last 4 characters show. For an &quot;Other service&quot;, name the real company behind it, because some services resell other companies&apos; models.</p>
      </section>

      <form onSubmit={saveLimits} className="grid gap-5 grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))]">
        <section className="panel p-5 flex flex-col gap-3.5" aria-labelledby="gen-h">
          <h2 id="gen-h" className="m-0 text-base font-semibold">Writing</h2>
          <label className="field">Longest reading (tokens)<input className="input" inputMode="numeric" value={lim.ai_max_tokens} onChange={(e) => setLim({ ...lim, ai_max_tokens: e.target.value })} /></label>
          <label className="field">Creativity · {Number(lim.ai_temperature).toFixed(1)}<input type="range" min={0} max={1} step={0.1} value={lim.ai_temperature} onChange={(e) => setLim({ ...lim, ai_temperature: Number(e.target.value) })} className="accent-gold" /></label>
          <label className="field">Move to the next service after<select className="input" value={lim.ai_timeout_seconds} onChange={(e) => setLim({ ...lim, ai_timeout_seconds: Number(e.target.value) as 30 | 45 | 60 })}>{[30, 45, 60].map((n) => <option key={n} value={n}>{n} seconds</option>)}</select></label>
        </section>
        <section className="panel p-5 flex flex-col gap-3.5" aria-labelledby="bud-h">
          <h2 id="bud-h" className="m-0 text-base font-semibold">Limits</h2>
          <label className="field">Daily spending cap, all services (USD)<input className="input" inputMode="decimal" value={lim.ai_daily_cap_usd} onChange={(e) => setLim({ ...lim, ai_daily_cap_usd: e.target.value })} /></label>
          <label className="field">AI readings per person per day<input className="input" inputMode="numeric" value={lim.ai_per_person_per_day} onChange={(e) => setLim({ ...lim, ai_per_person_per_day: e.target.value })} /></label>
          <button type="submit" className="btn btn-gold self-start">Save writing and limits</button>
        </section>
      </form>

      <StepUpDialog
        open={asking !== null}
        description={asking?.description ?? ""}
        confirmLabel="Save the key"
        onConfirm={(code) => asking?.send(code) ?? Promise.resolve(null)}
        onCancel={() => setAsking(null)}
        messages={KEY_ERRORS}
      />
    </div>
  );
}
