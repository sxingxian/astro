import { catalogue } from "@astro/copy";
import { createDb, sql } from "@astro/db";

export interface MaintenanceState {
  on: boolean;
  title: string;
  body: string;
}

/** Not paused, with the default notice: the answer before the first read and whenever reads fail. */
export const NOT_PAUSED: MaintenanceState = { on: false, title: catalogue["app.maintenance.title"].default, body: catalogue["app.maintenance.body"].default };

/**
 * The database's own reason for a failed query (Drizzle's message only names the query). Postgres messages hold no
 * passwords; the query parameters are left out.
 */
export function describeDbError(e: unknown): string {
  const cause = e instanceof Error ? (e.cause as { code?: string; message?: string } | undefined) : undefined;
  const head = e instanceof Error ? (e.message.split("\n")[0] ?? "") : String(e);
  return cause?.message ? `${head} | cause: ${cause.code ? `${cause.code} ` : ""}${cause.message}` : head;
}

/**
 * A per-isolate check of whether the owner has paused the app. It re-reads at most once per `ttlSeconds`;
 * requests arriving together share one read; a read that takes longer than `timeoutMs` or fails leaves the last
 * answer (or "off") standing, so a slow or broken database never holds up pages or shows everyone the notice.
 */
export function makeMaintenanceCheck<V = boolean>(read: () => Promise<V>, initial: V = false as V) {
  let cached: { on: V; at: number } | null = null;
  let inFlight: Promise<V> | null = null;
  return async function isMaintenance(ttlSeconds: number, timeoutMs: number, now: () => number = Date.now): Promise<V> {
    if (cached && now() - cached.at < ttlSeconds * 1000) return cached.on;
    if (!inFlight) {
      const startedAt = now();
      inFlight = read()
        .then((on) => {
          cached = { on, at: startedAt };
          return on;
        })
        .catch((e: unknown) => {
          console.error("maintenance check failed", describeDbError(e));
          cached = { on: cached?.on ?? initial, at: startedAt };
          return cached.on;
        })
        .finally(() => {
          inFlight = null;
        });
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const fallback = new Promise<V>((resolve) => {
      timer = setTimeout(() => resolve(cached?.on ?? initial), timeoutMs);
    });
    try {
      return await Promise.race([inFlight, fallback]);
    } finally {
      clearTimeout(timer);
    }
  };
}

/** Reads the flag and the notice's published wording in one query, with a short-lived client. */
export async function readMaintenance(connectionString: string): Promise<MaintenanceState> {
  const db = createDb(connectionString);
  try {
    const [row] = await db.execute<{ flag: unknown; title: string | null; body: string | null }>(sql`
      select (select value from app_setting where key = 'maintenance_mode') as flag,
             v.snapshot->>'app.maintenance.title' as title, v.snapshot->>'app.maintenance.body' as body
      from (select 1) one left join lateral (select snapshot from text_version where kind = 'app' order by id desc limit 1) v on true`);
    return { on: row?.flag === true, title: row?.title ?? NOT_PAUSED.title, body: row?.body ?? NOT_PAUSED.body };
  } finally {
    await db.$client.end({ timeout: 1 }).catch(() => {});
  }
}

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** A self-contained page for the 503 response: no scripts, no app shell, nothing that needs the database. */
export function maintenanceHtml({ title, body }: { title: string; body: string }): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${escape(title)} · Astro</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0B0B14;color:#EDE6D6;font-family:Inter,system-ui,sans-serif;padding:24px;box-sizing:border-box}main{max-width:440px;text-align:center;display:flex;flex-direction:column;gap:12px}h1{margin:0;font:500 32px/1.2 'Cormorant Garamond',Georgia,serif}p{margin:0;color:#B9B4CF;line-height:1.6}svg{margin:0 auto}</style></head>
<body><main><svg width="28" height="28" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 7.2L21 12l-7.2 1.8L12 21l-1.8-7.2L3 12l7.2-1.8z" fill="none" stroke="#D8B46A" stroke-width="1.4" stroke-linejoin="round"/></svg><h1>${escape(title)}</h1><p>${escape(body)}</p></main></body></html>`;
}
